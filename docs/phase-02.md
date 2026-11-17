# Phase 02 — Reliable paid checks and reusable evidence

This phase completes request recovery, receipt accuracy, and sharing control while preserving the live Telegraph testnet integration and the compact app UI.

## Delivered

- Provider outcomes saved individually before parallel requests finish.
- Atomic, single-use quote submission; duplicates read the existing request.
- Exact integer USDC arithmetic and explicit unknown charges.
- Separate payment receipts and original provider responses.
- Complete, partial, failed, running, and needs-review states.
- Private result URLs with refresh recovery and progress polling.
- Itemized quotes with expiry countdown and deliberate refresh.
- Wallet account-change handling, reconnect/disconnect, and Sepolia selection.
- History filters, pagination, timestamps, exact spend/receipt totals, and JSON export.
- Owner-only sharing changes, opaque share tokens, revocation, and token rotation.
- Deterministic production-code tests, live unsigned-quote integration tests, optional isolated browser tests, and GitHub Actions CI.

## Runtime boundaries

The app never signs payments for the user. No funded-wallet settlement has been performed by the build agent. Automated tests use controlled payment responses only inside the isolated test harness; the shipped app has no demo mode or fabricated verification results.

Direct uploads still require storage URLs that Telegraph can fetch. The hosted Site's private audience remains unchanged, so share URLs are subject to Site access. Making the Site public is a separate audience decision, not a change made implicitly by this phase.

Epoch proof links are the protocol's original endpoints. A recorded receipt is a purchase record, not an independent guarantee that the media verdict is true.
