# RosterPocket

A personal weekly planner for people balancing casual jobs, classes and other commitments. Preview an extra shift before adding it, then keep the original plan separate from the hours actually worked.

## Run locally

Use Node 24.22 or newer in the Node 24 release line.

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. Development uses `npm run dev`. Records belong to the browser and origin where they were entered, so development and preview addresses have separate storage. There is no account, server database, sync or hosted deployment included. The production build prepares an offline shell on HTTPS or localhost. Wait for **Offline ready** before relying on offline reopening. Supporting browsers may offer Add to Home Screen / Install; OS-level installation has not been certified across platforms.

## Use

Choose **Try a sample week** to load four fictional entries into an empty schedule, or add your own work shift or commitment. The composer checks overlaps, your chosen transition buffer and the displayed week's work budget. Checking a proposal does not save it. Clashing entries require an explicit override before saving.

Commitments can be copied weekly for up to 12 weeks. Each copy becomes an independent entry. Edit or delete individual entries from the weekly list. For work, **Record actual hours** stores a separate start, finish and unpaid break; unconfirmed actual work stays unknown, rather than becoming zero.

Settings control the view time zone, personal hour budget and transition buffer. Changing the view zone preserves stored instants. Totals attribute each entire shift to its start day in the view zone, including overnight work. These are planning preferences and personal records, not payroll, employment-condition or visa-compliance calculations.

Download a JSON backup regularly. Restore validates the file and previews replacement before changing the saved schedule. CSV exports retain empty cells for unconfirmed actuals. Labels and times can be sensitive; keep exported files secure.

## Verification

```sh
npm test
npm run build
npx playwright install --with-deps chromium webkit
npm run test:browser
```

Domain tests cover elapsed-time arithmetic, DST ambiguity, overlap/buffer boundaries, unknown actual work, weekly grouping, bounded recurrence, validation and exports. The browser suite exercises persistence, conflict overrides, actual records, backup restore, cross-tab writes and mobile layout against the built app. Browser artifacts are retained by CI for seven days.

See [schedule semantics and storage](docs/SEMANTICS.md) and [privacy and security boundaries](docs/SECURITY.md). Demo records and automated tests use synthetic schedules. No real-user adoption, statutory compliance or production deployment is claimed.
