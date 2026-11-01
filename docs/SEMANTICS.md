# Schedule and storage semantics

The React/TypeScript UI calls pure scheduling functions in `src/domain.ts`. `src/storage.ts` stores one validated workspace snapshot in IndexedDB. A save becomes visible in the UI only after its transaction completes; rejected writes do not replace the last committed workspace. No network API is used to store schedules.

## Time and totals

Supported zones are Brisbane, Sydney, Melbourne, Adelaide, Perth, Darwin, Hobart, Lord Howe and UTC. Each entry stores its original zone plus minute-aligned UTC instants. A bundled Temporal polyfill handles local-clock conversion because native Temporal availability varies across browsers. Ambiguous fall-back times and nonexistent spring-forward times are rejected; the app does not choose an offset silently. Runtime time-zone rules come from the browser's Intl data and can change with platform updates.

Entries must start and end between 2000 and 2099, last more than zero and no more than 36 elapsed hours, and have an integral unpaid break no longer than their elapsed duration. Elapsed work minus the entered unpaid break is net work time. A real zero net duration is possible when the entire interval is recorded as an unpaid break. Break timing is not inferred.

A Monday-based view includes entries whose start date falls in that week in the selected view zone. An overnight or boundary-crossing shift is counted entirely against its start day; totals are **not** an allocation of individual worked minutes across calendar/legal reporting periods. Changing the view zone can move an entry into another start-day group but never changes its stored instant. Actual totals are attached to the planned entry's week, even if the actual start differs. They show recorded work for that cohort, not independently regrouped actual activity.

Work totals exclude commitments. Missing actual records remain null and contribute to the unconfirmed count. Where some actuals exist, the displayed actual total sums those records only and retains the missing count; it does not estimate all work. The fictional sample has 11 planned work hours, six recorded actual hours and one unconfirmed work shift.

## Proposed shifts and weekly copies

A proposal is checked against the complete saved schedule, including entries outside the displayed week. Exact adjacency is allowed with a zero buffer. A positive gap smaller than the personal buffer is a short transition; an intersecting interval is an overlap. The check uses full occupied intervals, without treating unpaid breaks as free time. It also checks candidates against other candidates when a weekly copy is proposed. It does not calculate routes, travel time, rest entitlements, fatigue or eligibility to work.

The preview displays the budget effect for the currently displayed week. Weekly commitment copies preserve local clock times in their original zone. All copies are validated before an atomic save; an invalid DST occurrence refuses the entire set. They are separate entries, not a recurring series with later automatic expansion. Editing affects one entry. Changing the displayed week resets an unsaved composer draft/preview. Saving an edited plan retains any independently recorded actual hours.

## Persistence and exchange

Workspace schema v1 has exact fields: schemaVersion, settings and entries. Settings hold view zone, budget minutes and buffer minutes. Entries hold id, kind, label, original zone, planned start/end/unpaid break and nullable actual start/end/unpaid break. There are no salary, location, visa or payroll fields. Labels are 1–80 non-control characters, IDs are unique, and at most 1,000 entries are accepted. JSON backups are capped at 2 MiB, reject repeated fields and unknown schema fields/versions, and are validated before a replacement preview. There is no lossy import, schema downgrade or partial restore. CSV is an export view, not an import format.

IndexedDB version 1 uses the workspace object store. It is the first schema; future versions need deliberate migrations rather than silently resetting records. A transaction compares the current revision with the loaded revision before replacing the snapshot. A stale tab is refused and instructed to reload, preventing a silent lost update. This is not cross-device sync. Schema/read failures are shown instead of overwriting storage with an empty schedule. Normal browser clearing, origin changes and device loss can still remove access; downloaded backups are separate files the user must keep safely.

Production output is a static Vite build with a bundled React runtime and Temporal polyfill; no third-party CDN, API keys or backend are needed. The production build includes a manifest and a build-hashed service worker. It caches only the generated static shell and assets, not schedules or exports. First loading still needs the server. After successful preparation on HTTPS or localhost, cached pages can reopen offline and continue writing IndexedDB. Browser cache clearing can remove this capability. Development does not register a worker. Updates wait for existing tabs to close, avoiding a forced reload during editing; old caches are scoped by the app origin/path. OS-level installation and native browser prompts vary by browser and are not guaranteed by a manifest alone.

Primary guidance checked 2 November 2026: [React build guidance](https://react.dev/learn/build-a-react-app-from-scratch), [Vite](https://vite.dev/guide/), [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill), [Temporal time disambiguation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/from), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Offline guidance checked 2 November 2026: [service worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) and [PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable). Offline browser tests use the production build; an ordinary insecure HTTP hostname cannot register a service worker.
