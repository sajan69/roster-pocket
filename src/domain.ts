import { Temporal } from "@js-temporal/polyfill";
export { Temporal };
export const ZONES = [
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Adelaide",
  "Australia/Perth",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Lord_Howe",
  "UTC",
] as const;
export type WorkTime = { start: string; end: string; breakMinutes: number };
export type Entry = WorkTime & {
  id: string;
  kind: "work" | "commitment";
  label: string;
  zone: string;
  actual: WorkTime | null;
};
export type Workspace = {
  schemaVersion: 1;
  settings: { zone: string; budgetMinutes: number; bufferMinutes: number };
  entries: Entry[];
};
export const empty = (): Workspace => ({
  schemaVersion: 1,
  settings: {
    zone: "Australia/Brisbane",
    budgetMinutes: 1200,
    bufferMinutes: 30,
  },
  entries: [],
});
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function exact(
  x: unknown,
  keys: string[],
): asserts x is Record<string, unknown> {
  check(x && typeof x === "object" && !Array.isArray(x), "Expected an object.");
  check(
    Object.keys(x).sort().join("|") === [...keys].sort().join("|"),
    "Unsupported or missing fields.",
  );
}
function integer(x: unknown, min: number, max: number): asserts x is number {
  check(
    typeof x === "number" && Number.isInteger(x) && x >= min && x <= max,
    "A number is outside the supported range.",
  );
}
export function instant(s: unknown): number {
  check(
    typeof s === "string" && /^20\d\d-\d\d-\d\dT\d\d:\d\d:00Z$/.test(s),
    "Use a minute-aligned UTC timestamp between 2000 and 2099.",
  );
  const n = Temporal.Instant.from(s).epochMilliseconds;
  check(Number.isFinite(n), "Invalid time.");
  return n;
}
export function duration(x: WorkTime): number {
  return (instant(x.end) - instant(x.start)) / 60000;
}
export function net(x: WorkTime): number {
  return duration(x) - x.breakMinutes;
}
function validateTime(x: Record<string, unknown>): WorkTime {
  const start = x.start as string,
    end = x.end as string;
  const minutes = (instant(end) - instant(start)) / 60000;
  check(
    minutes > 0 && minutes <= 2160,
    "End must follow start, within 36 hours.",
  );
  integer(x.breakMinutes, 0, minutes);
  return { start, end, breakMinutes: x.breakMinutes };
}
export function validate(value: unknown): Workspace {
  exact(value, ["schemaVersion", "settings", "entries"]);
  check(value.schemaVersion === 1, "This backup version is not supported.");
  exact(value.settings, ["zone", "budgetMinutes", "bufferMinutes"]);
  const s = value.settings;
  check(
    typeof s.zone === "string" && (ZONES as readonly string[]).includes(s.zone),
    "Unsupported time zone.",
  );
  integer(s.budgetMinutes, 0, 10080);
  integer(s.bufferMinutes, 0, 180);
  check(
    Array.isArray(value.entries) && value.entries.length <= 1000,
    "Keep at most 1,000 entries.",
  );
  const ids = new Set();
  const entries = Array.from(value.entries).map((item: unknown): Entry => {
    exact(item, [
      "id",
      "kind",
      "label",
      "zone",
      "start",
      "end",
      "breakMinutes",
      "actual",
    ]);
    check(
      typeof item.id === "string" &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(item.id) &&
        !ids.has(item.id),
      "Entry IDs must be unique.",
    );
    ids.add(item.id);
    check(
      item.kind === "work" || item.kind === "commitment",
      "Unsupported entry type.",
    );
    check(
      typeof item.label === "string" &&
        item.label.trim().length > 0 &&
        item.label.length <= 80 &&
        !/[\u0000-\u001f\u007f]/.test(item.label),
      "Use a label of 1–80 characters without control characters.",
    );
    check(
      typeof item.zone === "string" &&
        (ZONES as readonly string[]).includes(item.zone),
      "Unsupported entry time zone.",
    );
    const t = validateTime(item);
    let actual = null;
    if (item.actual !== null) {
      check(
        item.kind === "work",
        "Commitments cannot have actual work records.",
      );
      exact(item.actual, ["start", "end", "breakMinutes"]);
      actual = validateTime(item.actual);
    }
    check(
      item.kind === "work" || item.breakMinutes === 0,
      "Commitments do not deduct breaks.",
    );
    return {
      id: item.id,
      kind: item.kind,
      label: item.label,
      zone: item.zone,
      ...t,
      actual,
    };
  });
  return {
    schemaVersion: 1,
    settings: {
      zone: s.zone,
      budgetMinutes: s.budgetMinutes,
      bufferMinutes: s.bufferMinutes,
    },
    entries,
  };
}
// Reject repeated JSON keys after native syntax parsing, before accepting the workspace.
export function decodeBackup(bytes: ArrayBuffer): Workspace {
  check(bytes.byteLength <= 2 * 1024 * 1024, "Backup exceeds 2 MiB.");
  return parseBackup(
    new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
  );
}
export function parseBackup(raw: string): Workspace {
  check(
    new TextEncoder().encode(raw).length <= 2 * 1024 * 1024,
    "Backup exceeds 2 MiB.",
  );
  const value: unknown = JSON.parse(raw);
  const stack: { object: boolean; keys: Set<string>; key: boolean }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      let j = i + 1;
      for (; j < raw.length; j++) {
        if (raw[j] === "\\") {
          j++;
          continue;
        }
        if (raw[j] === '"') break;
      }
      const top = stack.at(-1);
      if (top?.object && top.key) {
        const k = JSON.parse(raw.slice(i, j + 1)) as string;
        check(!top.keys.has(k), "Backup contains repeated fields.");
        top.keys.add(k);
        top.key = false;
      }
      i = j;
    } else if (c === "{" || c === "[") {
      stack.push({ object: c === "{", keys: new Set(), key: c === "{" });
      check(stack.length <= 32, "Backup is too deeply nested.");
    } else if (c === "}" || c === "]") stack.pop();
    else if (c === "," && stack.at(-1)?.object) stack.at(-1)!.key = true;
  }
  return validate(value);
}
export function localToInstant(
  date: string,
  time: string,
  zone: string,
): string {
  check((ZONES as readonly string[]).includes(zone), "Unsupported time zone.");
  check(
    /^20\d\d-\d\d-\d\d$/.test(date) && /^\d\d:\d\d$/.test(time),
    "Enter a full date and time.",
  );
  try {
    return Temporal.ZonedDateTime.from(`${date}T${time}:00[${zone}]`, {
      disambiguation: "reject",
      overflow: "reject",
    })
      .toInstant()
      .toString({ smallestUnit: "second" });
  } catch {
    throw new Error(
      "This local time is invalid or ambiguous in the selected zone. Choose an unambiguous time.",
    );
  }
}
export function localParts(utc: string, zone: string) {
  const z = Temporal.Instant.from(utc).toZonedDateTimeISO(zone);
  return {
    date: z.toPlainDate().toString(),
    time: z.toPlainTime().toString({ smallestUnit: "minute" }),
  };
}
export function monday(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return d.subtract({ days: d.dayOfWeek - 1 }).toString();
}
export function addDays(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function weekEntries(data: Workspace, week: string): Entry[] {
  const end = addDays(week, 7);
  return data.entries
    .filter((e) => {
      const date = localParts(e.start, data.settings.zone).date;
      return date >= week && date < end;
    })
    .sort(
      (a, b) => instant(a.start) - instant(b.start) || a.id.localeCompare(b.id),
    );
}
export function totals(entries: Entry[]) {
  const work = entries.filter((e) => e.kind === "work");
  const confirmed = work.filter((e) => e.actual !== null);
  return {
    planned: work.reduce((n, e) => n + net(e), 0),
    actual: confirmed.length
      ? confirmed.reduce((n, e) => n + net(e.actual!), 0)
      : null,
    unconfirmed: work.length - confirmed.length,
  };
}
export type Conflict = {
  a: Entry;
  b: Entry;
  type: "overlap" | "buffer";
  gap: number;
};
export type ConflictList = Conflict[] & { total: number };
export function conflicts(
  candidates: Entry[],
  existing: Entry[],
  buffer: number,
): ConflictList {
  const found = Object.assign([] as Conflict[], { total: 0 });
  const prepare = (entry: Entry) => ({
    entry,
    start: instant(entry.start),
    end: instant(entry.end),
  });
  const proposed = candidates.map(prepare),
    saved = existing.map(prepare);
  function compare(
    a: ReturnType<typeof prepare>,
    b: ReturnType<typeof prepare>,
  ) {
    const gap = (Math.max(a.start, b.start) - Math.min(a.end, b.end)) / 60000;
    if (gap < buffer || gap < 0) {
      found.total++;
      if (found.length < 50)
        found.push({
          a: a.entry,
          b: b.entry,
          type: gap < 0 ? "overlap" : "buffer",
          gap,
        });
    }
  }
  for (let i = 0; i < proposed.length; i++) {
    for (const other of saved) compare(proposed[i], other);
    for (let j = i + 1; j < proposed.length; j++)
      compare(proposed[i], proposed[j]);
  }
  return found;
}
export function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function repeats(entry: Entry, weeks: number): Entry[] {
  integer(weeks, 1, 12);
  return Array.from({ length: weeks }, (_, i) => {
    if (!i) return entry;
    const start = localParts(entry.start, entry.zone),
      end = localParts(entry.end, entry.zone);
    return {
      ...entry,
      id: newId(),
      start: localToInstant(addDays(start.date, 7 * i), start.time, entry.zone),
      end: localToInstant(addDays(end.date, 7 * i), end.time, entry.zone),
    };
  });
}
export function hours(minutes: number | null) {
  return minutes === null
    ? "Not recorded"
    : `${(minutes / 60).toLocaleString("en-AU", { maximumFractionDigits: 2 })} h`;
}
export function csv(data: Workspace): string {
  const cell = (v: unknown) => {
    let s = v === null ? "" : String(v);
    if (/^[=+@-]/.test(s.normalize("NFKC").trimStart()) || /^[\t\r\n]/.test(s))
      s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    [
      "kind",
      "label",
      "entry_zone",
      "planned_start_utc",
      "planned_end_utc",
      "planned_break_minutes",
      "planned_net_minutes",
      "actual_start_utc",
      "actual_end_utc",
      "actual_break_minutes",
      "actual_net_minutes",
    ],
    ...data.entries.map((e) => [
      e.kind,
      e.label,
      e.zone,
      e.start,
      e.end,
      e.breakMinutes,
      net(e),
      e.actual?.start ?? null,
      e.actual?.end ?? null,
      e.actual?.breakMinutes ?? null,
      e.actual ? net(e.actual) : null,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export function demo(week: string, zone: string): Workspace {
  const slot = (
    id: string,
    kind: Entry["kind"],
    label: string,
    day: number,
    start: string,
    end: string,
  ): Entry => ({
    id,
    kind,
    label,
    zone,
    start: localToInstant(addDays(week, day), start, zone),
    end: localToInstant(addDays(week, day), end, zone),
    breakMinutes: kind === "work" ? 30 : 0,
    actual: null,
  });
  const entries = [
    slot("demo-cafe", "work", "Demo · Corner café", 0, "07:00", "13:00"),
    slot("demo-class", "commitment", "Demo · Class", 1, "09:00", "12:00"),
    slot("demo-store", "work", "Demo · Bookshop", 2, "14:00", "20:00"),
    slot("demo-study", "commitment", "Demo · Study time", 4, "10:00", "12:00"),
  ];
  entries[0].actual = {
    start: entries[0].start,
    end: localToInstant(week, "13:30", zone),
    breakMinutes: 30,
  };
  return validate({
    ...empty(),
    settings: { ...empty().settings, zone },
    entries,
  });
}
