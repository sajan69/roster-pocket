import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Temporal,
  ZONES,
  addDays,
  conflicts,
  csv,
  demo,
  empty,
  hours,
  instant,
  localParts,
  localToInstant,
  monday,
  net,
  newId,
  parseBackup,
  repeats,
  totals,
  validate,
  weekEntries,
} from "./domain";
import type { Entry, Workspace, WorkTime } from "./domain";
import { load, save } from "./storage";
import type { Snapshot } from "./storage";
import "./style.css";
import { useOffline } from "./offline";
const dateLabel = (d: string) =>
  Temporal.PlainDate.from(d).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
  });
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const offline = useOffline();
  const [stored, setStored] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [week, setWeek] = useState(
    monday(Temporal.Now.plainDateISO("Australia/Brisbane").toString()),
  );
  const [editing, setEditing] = useState<Entry | null>(null),
    [actual, setActual] = useState<Entry | null>(null),
    [formKey, setFormKey] = useState(0),
    [restore, setRestore] = useState<Workspace | null>(null);
  useEffect(() => {
    load()
      .then(setStored)
      .catch((e) => setError(e.message));
  }, []);
  async function commit(data: Workspace, message: string) {
    if (!stored || gate.current) return false;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await save(stored.revision, data);
      setStored(next);
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      gate.current = false;
    }
  }
  if (!stored)
    return (
      <main className="loading">
        <Brand />
        <h1>Your week, together.</h1>
        {error ? (
          <p role="alert">
            {error} Reload to try again. Saved data has not been replaced.
          </p>
        ) : (
          <p>Opening your saved schedule…</p>
        )}
      </main>
    );
  const data = stored.data,
    entries = weekEntries(data, week),
    sum = totals(entries),
    budget = data.settings.budgetMinutes;
  const resetForm = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
  };
  const allConflicts = conflicts(
    entries,
    data.entries.filter((e) => !entries.some((x) => x.id === e.id)),
    data.settings.bufferMinutes,
  );
  async function importFile(file: File) {
    setError("");
    try {
      if (file.size > 2 * 1024 * 1024) throw Error("Backup exceeds 2 MiB.");
      setRestore(parseBackup(await file.text()));
    } catch (e) {
      setError(
        (e as Error).message === "Unexpected end of JSON input"
          ? "This is not a valid backup."
          : "Backup could not be loaded. Check its format and version; no records were changed.",
      );
    }
  }
  return (
    <>
      <header>
        <Brand />
        <span className="privacy">
          On this browser ·{" "}
          {offline.ready ? "Offline ready" : "No account needed"}
        </span>
        <button
          className="quiet"
          onClick={() =>
            document
              .getElementById("settings")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Settings & backup
        </button>
      </header>
      <main>
        {!offline.online && (
          <p className="banner" role="status">
            You’re offline. Your saved records stay on this browser.
          </p>
        )}
        <section className="intro">
          <div>
            <p className="eyebrow">WORK, CLASSES, AND THE REST OF LIFE</p>
            <h1>Make room for your week.</h1>
            <p>
              See your commitments together. Check an extra shift before you
              make it part of the plan.
            </p>
          </div>
          {data.entries.length === 0 && (
            <button
              disabled={busy}
              onClick={() =>
                void commit(
                  demo(week, data.settings.zone),
                  "Sample schedule loaded. Entries marked Demo are fictional.",
                )
              }
            >
              Try a sample week <span aria-hidden="true">↗</span>
            </button>
          )}
        </section>
        {error && (
          <div className="banner danger" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="banner" role="status">
            {notice}
            <button
              className="quiet"
              aria-label="Dismiss message"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        <section className="summary" aria-label="Week summary">
          <div>
            <span>Planned work</span>
            <strong>{hours(sum.planned)}</strong>
            <small>Shifts starting this week</small>
          </div>
          <div>
            <span>Recorded actual</span>
            <strong>{hours(sum.actual)}</strong>
            <small>
              {sum.unconfirmed} work{" "}
              {sum.unconfirmed === 1 ? "shift" : "shifts"} unconfirmed
            </small>
          </div>
          <div>
            <span>Personal hour budget</span>
            <strong>{hours(budget)}</strong>
            <small>
              {sum.planned > budget
                ? `${hours(sum.planned - budget)} above your preference`
                : `${hours(budget - sum.planned)} left in your plan`}
            </small>
          </div>
        </section>
        <div className="workspace">
          <section className="schedule" aria-label="Weekly schedule">
            <div className="section-heading">
              <div>
                <h2>Your week</h2>
                <span className="muted">
                  {data.settings.zone.replaceAll("_", " ")} ·{" "}
                  {data.settings.bufferMinutes} min transition preference
                </span>
              </div>
              <div className="weeknav">
                <button
                  className="quiet"
                  aria-label="Previous week"
                  onClick={() => setWeek(addDays(week, -7))}
                >
                  ←
                </button>
                <label className="sr-only" htmlFor="week">
                  Week starting
                </label>
                <input
                  id="week"
                  type="date"
                  value={week}
                  min="2000-01-03"
                  max="2099-12-28"
                  onChange={(e) => {
                    if (e.target.value) setWeek(monday(e.target.value));
                  }}
                />
                <button
                  className="quiet"
                  aria-label="Next week"
                  onClick={() => setWeek(addDays(week, 7))}
                >
                  →
                </button>
              </div>
            </div>
            {allConflicts.total > 0 && (
              <p className="conflict-note">
                {allConflicts.total} overlap or short transition{" "}
                {allConflicts.total === 1 ? "needs" : "need"} a closer look.
                Your records are kept as entered.
              </p>
            )}
            <div className="days">
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(week, i),
                  items = entries.filter(
                    (e) => localParts(e.start, data.settings.zone).date === d,
                  );
                return (
                  <section className="day" key={d} aria-label={d}>
                    <div className="day-label">
                      <b>
                        {Temporal.PlainDate.from(d).toLocaleString("en-AU", {
                          weekday: "short",
                        })}
                      </b>
                      <span>{dateLabel(d)}</span>
                    </div>
                    <div className="day-items">
                      {items.length === 0 ? (
                        <span className="free">Room to breathe</span>
                      ) : (
                        items.map((e) => (
                          <article key={e.id} className={`entry ${e.kind}`}>
                            <div className="entry-top">
                              <span className="tag">
                                {e.kind === "work" ? "WORK" : "COMMITMENT"}
                              </span>
                              {e.actual && (
                                <span className="recorded">
                                  Actual recorded
                                </span>
                              )}
                            </div>
                            <h3>{e.label}</h3>
                            <p className="time">
                              {localParts(e.start, data.settings.zone).time} →{" "}
                              {localParts(e.end, data.settings.zone).time}
                              {localParts(e.end, data.settings.zone).date !==
                                d &&
                                ` · ends ${dateLabel(localParts(e.end, data.settings.zone).date)}`}
                            </p>
                            {e.kind === "work" && (
                              <p className="muted">
                                Planned {hours(net(e))} · {e.breakMinutes} min
                                unpaid break
                                {e.actual && (
                                  <> · Actual {hours(net(e.actual))}</>
                                )}
                              </p>
                            )}
                            <div className="entry-actions">
                              <button
                                className="quiet"
                                disabled={busy}
                                onClick={() => {
                                  setEditing(e);
                                  setActual(null);
                                  setFormKey((k) => k + 1);
                                  document
                                    .getElementById("composer")
                                    ?.scrollIntoView({ behavior: "smooth" });
                                }}
                              >
                                Edit
                              </button>
                              {e.kind === "work" && (
                                <button
                                  className="quiet"
                                  disabled={busy}
                                  onClick={() => {
                                    setError("");
                                    setActual(e);
                                  }}
                                >
                                  {e.actual
                                    ? "Edit actual"
                                    : "Record actual hours"}
                                </button>
                              )}
                              <button
                                className="quiet delete"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm(`Delete “${e.label}”?`))
                                    void commit(
                                      {
                                        ...data,
                                        entries: data.entries.filter(
                                          (x) => x.id !== e.id,
                                        ),
                                      },
                                      "Entry deleted.",
                                    );
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            <p className="footnote">
              Work totals deduct the breaks you enter. Overnight shifts count
              toward their start day in the selected view zone. Unconfirmed
              actual work is unknown, not zero.
            </p>
          </section>
          <aside id="composer">
            <Composer
              key={`${formKey}-${week}`}
              data={data}
              week={week}
              editing={editing}
              busy={busy}
              onCancel={resetForm}
              onSave={async (list) => {
                const updated = {
                  ...data,
                  entries: [
                    ...data.entries.filter((e) => e.id !== editing?.id),
                    ...list,
                  ],
                };
                if (
                  await commit(
                    updated,
                    editing ? "Plan updated." : "Added to your plan.",
                  )
                )
                  resetForm();
              }}
            />
          </aside>
        </div>
        {actual && (
          <ActualDialog onClose={() => setActual(null)}>
            <h2 id="actual-heading">Actual hours · {actual.label}</h2>
            <p>Keep what happened separate from the original plan.</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <TimeForm
              initial={actual.actual ?? actual}
              zone={actual.zone}
              busy={busy}
              onCancel={() => setActual(null)}
              onSave={async (value) => {
                if (
                  await commit(
                    {
                      ...data,
                      entries: data.entries.map((e) =>
                        e.id === actual.id ? { ...e, actual: value } : e,
                      ),
                    },
                    "Actual hours saved.",
                  )
                )
                  setActual(null);
              }}
            />
            {actual.actual && (
              <button
                className="quiet delete"
                disabled={busy}
                onClick={async () => {
                  if (
                    await commit(
                      {
                        ...data,
                        entries: data.entries.map((e) =>
                          e.id === actual.id ? { ...e, actual: null } : e,
                        ),
                      },
                      "Actual record removed; this shift is unconfirmed.",
                    )
                  )
                    setActual(null);
                }}
              >
                Remove actual record
              </button>
            )}
          </ActualDialog>
        )}
        <section id="settings" className="settings">
          <div>
            <p className="eyebrow">YOUR PREFERENCES</p>
            <h2>Keep it yours.</h2>
            <p>
              Budgets and buffers help you plan. They are not payroll,
              employment or visa-rule calculations.
            </p>
            <Settings
              key={JSON.stringify(data.settings)}
              data={data}
              busy={busy}
              onSave={(value) =>
                void commit(
                  { ...data, settings: value },
                  "Preferences saved. Existing times were not changed.",
                )
              }
            />
          </div>
          <div className="backup">
            <h3>Your records stay in this browser</h3>
            <p>
              Browser storage can be cleared. Download a backup regularly and
              store it securely; it contains your labels and schedule times.
            </p>
            <button
              className="secondary"
              onClick={() =>
                download(
                  "roster-pocket-backup.json",
                  JSON.stringify(data, null, 2),
                  "application/json",
                )
              }
            >
              Download backup
            </button>{" "}
            <button
              className="quiet"
              onClick={() =>
                download(
                  "roster-pocket-hours.csv",
                  csv(data),
                  "text/csv;charset=utf-8",
                )
              }
            >
              Export hours CSV
            </button>
            <label className="file-button">
              Restore backup
              <input
                type="file"
                accept="application/json,.json"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {restore && (
              <div className="restore">
                <p>
                  Replace your current {data.entries.length} entries with{" "}
                  {restore.entries.length} entries from this backup? Download
                  your current backup first if you need it.
                </p>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (await commit(restore, "Backup restored.")) {
                      setRestore(null);
                      resetForm();
                      setActual(null);
                    }
                  }}
                >
                  Replace with backup
                </button>
                <button className="quiet" onClick={() => setRestore(null)}>
                  Cancel restore
                </button>
              </div>
            )}
            <p className="footnote">
              Same browser and address only. No sync, GPS, telemetry or employer
              messages.
            </p>
            <button
              className="quiet delete"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Delete every saved entry? Download a backup first if you need to keep your records.",
                  )
                ) {
                  void commit({ ...data, entries: [] }, "All entries deleted.");
                  resetForm();
                  setActual(null);
                }
              }}
            >
              Delete all entries
            </button>
          </div>
        </section>
        <footer>
          RosterPocket <span>Your time. Your own record.</span>
        </footer>
      </main>
    </>
  );
}
function ActualDialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="actual-heading"
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
function Brand() {
  return (
    <a className="brand" href="#">
      <span className="brand-mark" aria-hidden="true">
        rp
      </span>
      RosterPocket<span className="beta">EARLY RELEASE</span>
    </a>
  );
}
function Settings({
  data,
  busy,
  onSave,
}: {
  data: Workspace;
  busy: boolean;
  onSave: (s: Workspace["settings"]) => void;
}) {
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSave({
          zone: String(f.get("zone")),
          budgetMinutes: Math.round(Number(f.get("budget")) * 60),
          bufferMinutes: Number(f.get("buffer")),
        });
      }}
    >
      <label>
        View time zone
        <select name="zone" defaultValue={data.settings.zone}>
          {ZONES.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </label>
      <label>
        Weekly hour budget
        <input
          name="budget"
          type="number"
          min="0"
          max="168"
          step="0.25"
          defaultValue={data.settings.budgetMinutes / 60}
          required
        />
      </label>
      <label>
        Transition buffer (minutes)
        <input
          name="buffer"
          type="number"
          min="0"
          max="180"
          defaultValue={data.settings.bufferMinutes}
          required
        />
      </label>
      <button className="secondary" disabled={busy}>
        Save preferences
      </button>
    </form>
  );
}
type FormValue = {
  label: string;
  kind: Entry["kind"];
  date: string;
  time: string;
  endDate: string;
  endTime: string;
  breakMinutes: number;
  weeks: number;
};
function Composer({
  data,
  week,
  editing,
  busy,
  onCancel,
  onSave,
}: {
  data: Workspace;
  week: string;
  editing: Entry | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (list: Entry[]) => Promise<void>;
}) {
  const zone = editing?.zone ?? data.settings.zone;
  const start = editing
      ? localParts(editing.start, zone)
      : { date: week, time: "09:00" },
    end = editing
      ? localParts(editing.end, zone)
      : { date: week, time: "17:00" };
  const [f, setF] = useState<FormValue>({
    label: editing?.label ?? "",
    kind: editing?.kind ?? "work",
    date: start.date,
    time: start.time,
    endDate: end.date,
    endTime: end.time,
    breakMinutes: editing?.breakMinutes ?? 30,
    weeks: 1,
  });
  const [preview, setPreview] = useState<Entry[] | null>(null),
    [error, setError] = useState(""),
    [override, setOverride] = useState(false);
  function field<K extends keyof FormValue>(key: K, val: FormValue[K]) {
    setF((x) => ({ ...x, [key]: val }));
    setPreview(null);
    setError("");
    setOverride(false);
  }
  const clashes = preview
    ? conflicts(
        preview,
        data.entries.filter((e) => e.id !== editing?.id),
        data.settings.bufferMinutes,
      )
    : conflicts([], [], data.settings.bufferMinutes);
  const proposedTotal = preview
    ? totals(
        weekEntries(
          {
            ...data,
            entries: [
              ...data.entries.filter((e) => e.id !== editing?.id),
              ...preview,
            ],
          },
          week,
        ),
      ).planned
    : null;
  return (
    <section className="composer">
      <p className="eyebrow">BEFORE YOU SAY YES</p>
      <h2>{editing ? "Edit your plan" : "Can I fit this shift?"}</h2>
      <p className="muted">
        Preview it first. Nothing is saved until you choose to add it.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const entry: Entry = {
              id: editing?.id ?? newId(),
              kind: f.kind,
              label: f.label.trim(),
              zone,
              start: localToInstant(f.date, f.time, zone),
              end: localToInstant(f.endDate, f.endTime, zone),
              breakMinutes: f.kind === "work" ? f.breakMinutes : 0,
              actual: editing?.actual ?? null,
            };
            const list = repeats(
              entry,
              f.kind === "commitment" && !editing ? f.weeks : 1,
            );
            validate({
              ...data,
              entries: [
                ...data.entries.filter((x) => x.id !== editing?.id),
                ...list,
              ],
            });
            setPreview(list);
            setError("");
            setOverride(false);
          } catch (e) {
            setPreview(null);
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Entry type
          <select
            value={f.kind}
            disabled={!!editing}
            onChange={(e) => field("kind", e.target.value as Entry["kind"])}
          >
            <option value="work">Work shift</option>
            <option value="commitment">Class or commitment</option>
          </select>
        </label>
        <label>
          {f.kind === "work" ? "Job / workplace" : "Commitment name"}
          <input
            value={f.label}
            maxLength={80}
            placeholder={
              f.kind === "work" ? "e.g. Corner café" : "e.g. Tuesday class"
            }
            required
            onChange={(e) => field("label", e.target.value)}
          />
        </label>
        <div className="field-row">
          <label>
            Start date
            <input
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={f.date}
              required
              onChange={(e) => {
                field("date", e.target.value);
                if (f.endDate === f.date) field("endDate", e.target.value);
              }}
            />
          </label>
          <label>
            Start time
            <input
              type="time"
              value={f.time}
              required
              onChange={(e) => field("time", e.target.value)}
            />
          </label>
        </div>
        <div className="field-row">
          <label>
            End date
            <input
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={f.endDate}
              required
              onChange={(e) => field("endDate", e.target.value)}
            />
          </label>
          <label>
            End time
            <input
              type="time"
              value={f.endTime}
              required
              onChange={(e) => field("endTime", e.target.value)}
            />
          </label>
        </div>
        {f.kind === "work" ? (
          <label>
            Unpaid break (minutes)
            <input
              type="number"
              min="0"
              max="2160"
              value={f.breakMinutes}
              required
              onChange={(e) => field("breakMinutes", Number(e.target.value))}
            />
          </label>
        ) : (
          !editing && (
            <label>
              Repeat weekly for (weeks)
              <input
                type="number"
                min="1"
                max="12"
                value={f.weeks}
                required
                onChange={(e) => field("weeks", Number(e.target.value))}
              />
            </label>
          )
        )}
        <p className="footnote">
          Times entered in {zone}. Overnight? Choose the following end date.
          Weekly commitments become separate entries.
        </p>
        <button className="secondary" disabled={busy}>
          Check {f.kind === "work" ? "this shift" : "commitment"}
        </button>
        {editing && (
          <button type="button" className="quiet" onClick={onCancel}>
            Cancel edit
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {preview && (
        <div
          className={`preview ${clashes.total ? "warning" : ""}`}
          aria-live="polite"
        >
          <h3>
            {clashes.total ? "A closer look needed" : "Fits your current plan"}
          </h3>
          {clashes.total ? (
            <ul>
              {clashes.slice(0, 8).map((c, i) => (
                <li key={i}>
                  {c.type === "overlap" ? "Overlaps" : "Short transition"}:{" "}
                  {c.a.label} ↔ {c.b.label}
                  {c.type === "buffer" && ` (${c.gap} min gap)`}
                </li>
              ))}
              {clashes.total > 8 && (
                <li>And {clashes.total - 8} more clashes.</li>
              )}
            </ul>
          ) : (
            <p>No overlap or short transition found against your saved plan.</p>
          )}
          <p>
            This displayed week would have <b>{hours(proposedTotal)}</b> planned
            work.
            {proposedTotal !== null &&
              proposedTotal > data.settings.budgetMinutes &&
              " Above your personal hour budget."}
          </p>
          {preview.length > 1 && (
            <p>
              {preview.length} weekly entries will be added; all occurrences
              were checked for clashes.
            </p>
          )}
          {clashes.total > 0 && (
            <label className="check">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Keep these entries despite the clashes
            </label>
          )}
          <button
            disabled={busy || (clashes.total > 0 && !override)}
            onClick={() => void onSave(preview)}
          >
            {busy
              ? "Saving…"
              : editing
                ? "Save plan changes"
                : "Add to my plan"}
          </button>
        </div>
      )}
    </section>
  );
}
function TimeForm({
  initial,
  zone,
  busy,
  onSave,
  onCancel,
}: {
  initial: WorkTime;
  zone: string;
  busy: boolean;
  onSave: (v: WorkTime) => Promise<void>;
  onCancel: () => void;
}) {
  const a = localParts(initial.start, zone),
    b = localParts(initial.end, zone);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const f = new FormData(e.currentTarget);
          const t = {
            start: localToInstant(
              String(f.get("date")),
              String(f.get("time")),
              zone,
            ),
            end: localToInstant(
              String(f.get("endDate")),
              String(f.get("endTime")),
              zone,
            ),
            breakMinutes: Number(f.get("break")),
          };
          const minutes = (instant(t.end) - instant(t.start)) / 60000;
          if (
            minutes <= 0 ||
            minutes > 2160 ||
            !Number.isInteger(t.breakMinutes) ||
            t.breakMinutes < 0 ||
            t.breakMinutes > minutes
          )
            throw Error("Check your end time and break length.");
          void onSave(t);
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p className="footnote">Times entered in {zone}</p>
      <div className="field-row">
        <label>
          Actual start date
          <input name="date" type="date" defaultValue={a.date} required />
        </label>
        <label>
          Actual start time
          <input name="time" type="time" defaultValue={a.time} required />
        </label>
      </div>
      <div className="field-row">
        <label>
          Actual end date
          <input name="endDate" type="date" defaultValue={b.date} required />
        </label>
        <label>
          Actual end time
          <input name="endTime" type="time" defaultValue={b.time} required />
        </label>
      </div>
      <label>
        Actual unpaid break (minutes)
        <input
          name="break"
          type="number"
          min="0"
          defaultValue={initial.breakMinutes}
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>Save actual hours</button>
      <button type="button" className="quiet" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
