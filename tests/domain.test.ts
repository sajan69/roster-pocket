import test from "node:test";
import assert from "node:assert/strict";
import {
  conflicts,
  csv,
  demo,
  empty,
  hours,
  localParts,
  localToInstant,
  monday,
  net,
  parseBackup,
  repeats,
  totals,
  validate,
  weekEntries,
} from "../src/domain";
import type { Entry } from "../src/domain";
function entry(
  id = "a",
  start = "2026-11-02T00:00:00Z",
  end = "2026-11-02T08:00:00Z",
): Entry {
  return {
    id,
    kind: "work",
    label: "Shop",
    zone: "Australia/Brisbane",
    start,
    end,
    breakMinutes: 30,
    actual: null,
  };
}
test("Overnight work uses elapsed time and break deduction", () => {
  const e = entry(
    "night",
    localToInstant("2026-11-02", "22:00", "Australia/Brisbane"),
    localToInstant("2026-11-03", "06:00", "Australia/Brisbane"),
  );
  assert.equal(net(e), 450);
  assert.equal(localParts(e.end, e.zone).date, "2026-11-03");
});
test("DST gap and fold are rejected, including Lord Howe half hour transition", () => {
  for (const [date, time, zone] of [
    ["2026-10-04", "02:30", "Australia/Sydney"],
    ["2026-04-05", "02:30", "Australia/Sydney"],
    ["2026-10-04", "02:15", "Australia/Lord_Howe"],
  ])
    assert.throws(() => localToInstant(date, time, zone), /ambiguous/);
});
test("DST elapsed hours are not wall-clock hours", () => {
  const e = entry(
    "dst",
    localToInstant("2026-10-03", "22:00", "Australia/Sydney"),
    localToInstant("2026-10-04", "06:00", "Australia/Sydney"),
  );
  e.breakMinutes = 0;
  assert.equal(net(e), 420);
});
test("Adjacency, overlap and transition buffers have explicit boundaries", () => {
  const a = entry(),
    b = entry("b", "2026-11-02T08:00:00Z", "2026-11-02T09:00:00Z");
  assert.equal(conflicts([b], [a], 0).length, 0);
  assert.equal(conflicts([b], [a], 30)[0].type, "buffer");
  b.start = "2026-11-02T07:59:00Z";
  assert.equal(conflicts([b], [a], 0)[0].type, "overlap");
  b.start = "2026-11-02T08:30:00Z";
  assert.equal(conflicts([b], [a], 30).length, 0);
});
test("Preview leaves saved inputs unchanged and checks candidate-to-candidate clashes", () => {
  const a = entry(),
    b = entry("b");
  const before = JSON.stringify(a);
  assert.equal(conflicts([a, b], [], 10).length, 1);
  assert.equal(JSON.stringify(a), before);
});
test("Actual missing is unknown, genuine zero is preserved", () => {
  const e = entry();
  assert.equal(totals([e]).actual, null);
  assert.equal(totals([e]).unconfirmed, 1);
  e.actual = { start: e.start, end: e.end, breakMinutes: 480 };
  assert.equal(totals([e]).actual, 0);
  assert.equal(totals([e]).planned, 450);
  assert.equal(hours(null), "Not recorded");
});
test("Weekly grouping uses selected view-zone start day without double-counting", () => {
  const d = empty();
  d.entries = [
    entry("boundary", "2026-11-01T13:00:00Z", "2026-11-01T20:00:00Z"),
  ];
  assert.equal(weekEntries(d, "2026-11-02").length, 0);
  d.settings.zone = "Australia/Sydney";
  assert.equal(weekEntries(d, "2026-11-02").length, 1);
  assert.equal(monday("2026-11-08"), "2026-11-02");
});
test("Weekly copies preserve local clock time across DST and never silently shift invalid times", () => {
  const e = entry(
    "class",
    localToInstant("2026-09-27", "09:00", "Australia/Sydney"),
    localToInstant("2026-09-27", "11:00", "Australia/Sydney"),
  );
  e.zone = "Australia/Sydney";
  const list = repeats(e, 2);
  assert.equal(localParts(list[1].start, e.zone).time, "09:00");
  assert.notEqual(list[0].id, list[1].id);
  assert.throws(() => repeats(e, 13));
});
test("Exact schema, IDs, links and numeric bounds are validated", () => {
  for (const patch of [
    { entries: [entry(), entry()] },
    { schemaVersion: 2 },
    { extra: true },
    { settings: { zone: "UTC", budgetMinutes: NaN, bufferMinutes: 0 } },
    { entries: [{ ...entry(), breakMinutes: 481 }] },
    { entries: [{ ...entry(), label: "\u0000" }] },
    {
      entries: [
        {
          ...entry(),
          actual: { start: entry().end, end: entry().start, breakMinutes: 0 },
        },
      ],
    },
  ])
    assert.throws(() => validate({ ...empty(), ...patch }));
  assert.throws(() =>
    validate({
      ...empty(),
      entries: Array.from({ length: 1001 }, (_, i) => entry(String(i))),
    }),
  );
});
test("Backup round trip rejects duplicate keys, malformed, oversized and unsupported data", () => {
  const d = demo("2026-11-02", "Australia/Brisbane");
  assert.deepEqual(parseBackup(JSON.stringify(d)), d);
  for (const raw of [
    '{"schemaVersion":1,"schemaVersion":1}',
    JSON.stringify({ ...empty(), schemaVersion: 3 }),
    "{oops",
    " ".repeat(2 * 1024 * 1024 + 1),
  ])
    assert.throws(() => parseBackup(raw));
});
test("CSV preserves empty actuals and mitigates formula labels", () => {
  const d = empty();
  d.entries = [{ ...entry(), label: " ＝1+1" }];
  const out = csv(d);
  assert.match(out, /' ＝1\+1/);
  assert.ok(out.endsWith(',"","","",""'));
  assert.match(out, /"450"/);
});
test("Known sample totals and commitment exclusion", () => {
  const d = demo("2026-11-02", "Australia/Brisbane");
  assert.deepEqual(totals(d.entries), {
    planned: 660,
    actual: 360,
    unconfirmed: 1,
  });
  assert.equal(d.entries.length, 4);
});

test("Maximum schedule counts every clash without retaining quadratic explanation objects", () => {
  const entries = Array.from({ length: 1000 }, (_, i) => entry(String(i)));
  const result = conflicts(entries, [], 30);
  assert.equal(result.total, 499500);
  assert.equal(result.length, 50);
});
