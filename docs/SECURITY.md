# Privacy and security boundaries

Schedules and employer labels can be personal information. The application stores them in the current browser's IndexedDB and has no accounts, telemetry, GPS, payslip attachments, third-party AI upload or employer-message integration. Public examples and tests are fictional; no personal schedules are imported automatically. Browser-local storage is a privacy design choice, not encryption or a privacy-law exemption.

Other users or scripts with access to the same browser profile/origin, compromised dependencies or device malware may access the records. Shared devices need appropriate browser/device protections. Browser storage can be cleared and is not a permanent backup. JSON/CSV exports contain readable labels and times; users control where those files are stored and shared. There is no password recovery or central copy.

React renders labels as text. The app never evaluates imported SQL/code or inserts labels as HTML. Backups have a 2 MiB input bound, exact schema/version validation, unique IDs, numeric/time caps and duplicate-field detection before acceptance. A backup is data, not executable configuration. Valid restoration replaces the whole schedule only after the user chooses the replacement action. No guarantee is made against all hostile browser files or resource exhaustion.

CSV quotes fields, doubles embedded quotes and prefixes formula-like strings after whitespace/NFKC checks. This reduces spreadsheet formula exposure but cannot guarantee how every spreadsheet importer behaves. Unconfirmed actual values remain empty, not zero. Review exports before using them elsewhere.

Production HTML limits scripts/styles to bundled same-origin assets and prohibits page-initiated network connections, objects, base-URL changes and form submission. The development server relaxes inline style and WebSocket restrictions for Vite's development tooling. A meta CSP does not provide all deployment-header protections, and a development server is not production hosting. No hosted release is included.

The app has no statutory wage, award, tax, visa, clinical or workplace-compliance engine. Hour budgets and transition buffers are personal preferences. Fair Work's [hours and roster guidance](https://www.fairwork.gov.au/employment-conditions/hours-of-work-breaks-and-rosters) and [Record My Hours](https://www.fairwork.gov.au/tools-and-resources/record-my-hours-app) describe separate workplace contexts and existing tools; personal records do not replace employer obligations. These references are context, not endorsement or validation of this application.

The production service worker fetches and caches only its generated same-origin static-asset list. Schedule content remains in IndexedDB and downloaded backups. Offline readiness needs a secure context (HTTPS or localhost) and successful first asset caching; it is not a data-backup or encryption guarantee. A failed registration leaves the ordinary app usable online.
