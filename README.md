# Lensy

Live media verification with visible prices, original network responses, and shareable receipts. Built with React, TypeScript, Vinext, Cloudflare D1, and R2.

Every check requests a real Telegraph quote. A funded Ethereum Sepolia wallet signs the exact escrow payment before any paid request is sent. The app has no simulated verification mode or hard-coded verdicts. Previous simulated records are retained in storage but excluded from results, history, sharing, media access, and the community feed.

The landing page is at `/`, the verification workspace is at `/app`, private saved results are at `/app/checks/:id`, and shared results are at `/s/:token`. The interface uses black, white, and brown with locally hosted Geist Light, Regular, and Medium (300–500). The Geist font license is included in `public/fonts/OFL.txt`.

The header's **Color theme** selector offers Light, Dark, and System on both the landing page and workspace. System follows the device setting. Your preference persists across pages and reloads and synchronizes between tabs. Theme changes also work when browser storage is unavailable.

## Use

1. Paste a direct public HTTPS image or video URL.
2. Request an exact network quote.
3. Connect your Ethereum wallet and approve the quoted payment.
4. Read the actual provider response, reported confidence, cost, and original receipt.
5. Share the stored completed check; opening it never purchases another check.

Direct uploads require provider-accessible storage. This private Site cannot expose its uploaded files to external verification providers, so the verification input is a public media URL. The Site remains private; shared links are subject to Site access settings.

Payments use Telegraph escrow on Ethereum Sepolia. Fund your wallet's escrow following https://anjoman.ai/docs/using/escrow-inference. Lensy never asks for or stores a wallet private key.

The backend discovers current schemas for `MEDIA_FORENSIC_VERIFY_GENERAL` and optional `IMAGE_CAPTIONING_GENERAL`, then reads an unsigned 402 quote. Each approval signs the network's exact EIP-191 message template with a fresh nonce and validity window under two minutes. Verification and captioning run in parallel. A database transition prevents submitting a quote twice. Missing or unstructured fields do not become invented verdicts or confidence scores. Failed verification remains a failed check even if optional captioning succeeds.

Raw receipts are stored with their result. Epoch proof links use real receipt hashes and epoch IDs. Final proofs may not exist until the epoch settles. If the connection fails after payment, inspect the saved check and network ledger before creating another purchase; the app does not automatically retry purchases.

## Request recovery and evidence

Each provider outcome is saved as it arrives. A successful verification and failed optional caption return a partial result with the available receipt. Refreshing a result reads its saved state without purchasing again. Duplicate submissions for the same quote return the existing request. Requests that lose their connection or remain unfinished are marked for review; they are never automatically repurchased.

USDC arithmetic uses integer millionths. A missing charge displays **Not reported**, with known charges shown separately. Raw answers are available separately from payment receipts. Rejected verdict fields and invalid confidence values are not presented as verified assessments.

My checks includes exact reported spend, original receipt counts, status filters, pagination, and a full JSON export. Completed checks can be shared with an opaque link and optionally listed in the feed. Revoking sharing disables the link and removes the feed entry. Sharing again creates a new token; the old token remains invalid. Private check endpoints, exports, statistics, and sharing changes enforce ownership.

## Compare and export evidence

Select up to four records in My checks, then choose **Compare selected**. The dedicated `/app/compare` workspace preserves selection order and can be refreshed or bookmarked. Every record must belong to the current workspace. Comparison reads stored evidence without buying another check, retains known charges when the total is unconfirmed, and counts unique receipt hashes.

History and feed searches now run across all eligible stored records before pagination. Search by name, source URL, or verdict, with status filters for completed, partial, running, failed, and needs-review checks.

**Download report** on a result or comparison saves a self-contained HTML evidence packet with findings, charges, payment receipts, and original provider responses. Open it offline or use the browser's Print → Save as PDF. Comparisons also export CSV. Exported files are snapshots and remain accessible after a share link is revoked. See [Phase 03](docs/phase-03.md).

## Local development

```sh
npm ci
npm run local
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. The native Node local runner starts at `http://127.0.0.1:5173`, applies pending migrations before accepting requests, and stores real SQLite data in ignored `.sites-runtime/local/lensy.sqlite`. It requires Node 22.13 or newer and does not need the Cloudflare Windows runtime. Verification still calls the live Telegraph testnet. Production builds retain the Cloudflare D1 and R2 bindings.

## Validation

```sh
npm run typecheck
npm test
npm run test:live  # requires the running local server
npm run build
```

The deterministic suite runs production route handlers and the verification pipeline against an isolated, real SQLite database with test-only network fixtures. It tests precision, partial failures, incremental receipt storage, expired signatures, duplicate submissions, ownership, sharing revocation and rotation, pagination, exports, and storage errors. CI runs type checking, these tests, and the production build on pushes and pull requests.

The live integration script requests an unsigned Telegraph quote, verifies that no result exists before payment, and rejects missing/invalid signatures. It makes **no paid requests**. End-to-end settlement still needs a funded wallet and has not been exercised by the build agent.

Optional browser tests use Playwright, a separate local server, and an isolated database. Browser-only quote/wallet fixtures never reach the real verification endpoint. Install Playwright with `npm install --no-save --package-lock=false playwright@1.65.0`, install Chromium with `npx playwright install chromium`, then run `npm run test:browser` after `npm test`. An existing Chromium-based browser can be selected with `LENSY_BROWSER_EXECUTABLE`; `LENSY_PLAYWRIGHT_MODULE` optionally selects an existing local Playwright module. Neither setting is needed by the app or CI's deterministic checks.

## Hosting

`.openai/hosting.json` declares the retained Site identity, `DB`, and `BUCKET`. Sites applies the checked-in Drizzle migration on publication. Browser QA requires an available browser installation.

Decorative coast photography: Unsplash photo-1473116763249-2faaef81ccda, bundled in `public/images/coast.jpg`. No verdict is assigned to this image.
