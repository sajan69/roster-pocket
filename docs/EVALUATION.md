# Verification and worked schedule

RosterPocket is a personal browser application. Verification uses fictional schedules and automated task completion, not observations of real users or employer systems.

## Reproduce a useful workflow

Build and open the app using the README commands. Choose **Try a sample week**, or restore [demo-workspace.json](../examples/demo-workspace.json) and view the week beginning 2 November 2026 in Brisbane. Restoring replaces the current schedule only after confirmation; use a separate browser profile or download an existing backup first.

The fixture contains two work shifts and two commitments. Cafe work is planned for six elapsed hours with a 30-minute unpaid break; bookshop work is planned for six hours with a 30-minute break. Only cafe work has an actual record: six and a half elapsed hours with a 30-minute break.

| Result | Expected value |
| --- | --- |
| Planned work | 11 hours |
| Actual work recorded for this plan | 6 hours |
| Work shifts without actual records | 1 |
| Entries | 4 |

Proposing an additional Monday 09:00–17:00 shift with a 30-minute break overlaps cafe work. Checking the proposal leaves the four saved entries unchanged and shows 18.5 proposed weekly work hours. Saving a clash requires an explicit override. Recording bookshop actual work as Wednesday 14:00–20:30 with a 30-minute break gives 12 actual hours for the plan, keeps 11 planned hours and removes the remaining unconfirmed count. These are arithmetic outcomes of fictional inputs, not evidence of time saved or employment compliance.

## Automated evidence

The [verification run](https://github.com/sajan69/roster-pocket/actions/runs/41341394753) at [9cbb2f5](https://github.com/sajan69/roster-pocket/commit/9cbb2f5ddd9fdebfe788f6185efcf0cef19e41b4) passed 13 Node domain tests and 24 browser cases: the same 12 task scenarios in Chromium and WebKit. It built the production bundle on a GitHub-hosted Ubuntu runner with Node 24 and Playwright 1.64.1. Later commits rerun this suite; the linked run identifies the evidence described here.

| Area | Observed automated result |
| --- | --- |
| Planning and actual work | Preview does not write; conflict override is deliberate; actual zero is distinct from unknown; editing actuals preserves the plan |
| Persistence | Saved entries survive reload; a stale second tab cannot silently overwrite a newer revision |
| Failure handling | A simulated quota exception preserves the prior saved workspace and draft; an unsupported stored schema is surfaced without resetting it |
| Offline use | After the production shell is prepared, a fresh offline page reopens the saved schedule and can save and reload another entry |
| Backup and CSV | Valid JSON round-trips through replacement preview; invalid input leaves the schedule intact; unknown actual values export as empty CSV fields |
| Time and layout | DST gaps/folds are refused; weekly copies preserve local clock time; a 390-pixel viewport has no page-level horizontal overflow |

Domain tests also check overnight elapsed time, buffer boundaries, view-zone grouping and full conflict accounting. A 1,000-entry all-overlapping fixture produces 499,500 conflicts while retaining only 50 explanations. This verifies counting and bounded retained detail, not a device latency target. The quota case injects an exception; it is not a physical disk-exhaustion experiment. Browser results and screenshots are CI artifacts retained for seven days.

Manual desktop checks of the fictional week confirmed the proposal and actual-hours flows in a rendered browser. Automated task completion is not a human usability study, accessibility certification or proof of reliability on every phone. WebKit automation is not native Safari/iOS installation certification. OS installation prompts, power loss, browser eviction, older browsers and multi-device sync are not validated here. Local data is not encrypted by the application and still needs user-managed backups. No hosted deployment, actual users, payroll accuracy or legal compliance is claimed.
