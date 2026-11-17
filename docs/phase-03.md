# Phase 03 — Compare and carry the evidence

## Delivered

- A dedicated `/app/compare` workspace for up to four saved checks.
- Selection from history or an owned result, retained in the current browser tab.
- Stable comparison URLs with ordered check IDs, refresh recovery, and removal.
- Ownership enforced for every check in one query; missing, foreign, unpaid, or non-live records make the whole comparison unavailable.
- Side-by-side media, assessments, findings, confidence, charges, and receipt counts.
- Exact aggregate totals, known partial charges, unique receipt counts, and explicit differences between provider assessments.
- Search across the full stored history or opt-in feed by name, source URL, or verdict, before pagination; status filters include recovered stale requests.
- Self-contained HTML evidence reports for single checks and comparisons, with original provider responses and payment receipts. Open the file in a browser to read offline or print/save as PDF.
- Comparison CSV export with spreadsheet formula neutralization.
- Responsive desktop/mobile layout in the established black, white, and brown palette.

## Verification

The deterministic suite covers comparison authorization, ordered reads, duplicate/invalid IDs, no provider calls, exact partial totals, receipt deduplication, safe HTML/CSV exports, full-history search, literal SQL wildcards, and stale status filters, alongside Phase 02's payment and sharing tests.

Browser tests use a separate database and unsigned quote fixtures. They exercise the real UI and route handlers: choosing records beyond the first history page, selection across searches, comparison refresh/removal, anonymous access rejection, offline HTML/PDF/CSV exports, and desktop/mobile layouts. Fixtures are never inserted into the user's database and the shipped app has no demo mode.

## Boundaries

Comparisons and exports read stored evidence and make no new paid requests. Provider confidence is not a comparative accuracy score. Offline reports are snapshots, not live cryptographic proof, and downloaded copies cannot be recalled by revoking a share link. Comparison URLs are private to the owning workspace; existing shared single-check links retain their revocation behavior.

The hosted Site keeps its existing audience. Direct uploads still need provider-accessible storage. Funded settlement still needs a user's wallet and has not been performed by the build agent.
