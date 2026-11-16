# Lensy

Live media verification with visible prices, original network responses, and shareable receipts. Built with React, TypeScript, Vinext, Cloudflare D1, and R2.

Every check requests a real Telegraph quote. A funded Ethereum Sepolia wallet signs the exact escrow payment before any paid request is sent. The app has no simulated verification mode or hard-coded verdicts. Previous simulated records are retained in storage but excluded from results, history, sharing, media access, and the community feed.

The landing page is at `/`, the verification workspace is at `/app`, and shared results are at `/s/:id`. The interface uses black, white, and brown with locally hosted Geist Light, Regular, and Medium (300–500). The Geist font license is included in `public/fonts/OFL.txt`.

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

## Local development

```sh
npm ci
npm run local
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. The native Node local runner starts at `http://127.0.0.1:5173`, applies pending migrations before accepting requests, and stores real SQLite data in ignored `.sites-runtime/local/lensy.sqlite`. It requires Node 22.13 or newer and does not need the Cloudflare Windows runtime. Verification still calls the live Telegraph testnet. Production builds retain the Cloudflare D1 and R2 bindings.

## Validation

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/integration.mjs
```

The integration script requests a live unsigned quote, verifies that no result exists before payment, rejects missing/invalid signatures locally, checks access boundaries, and confirms that removed simulated endpoints cannot create results. It makes **no paid requests**. End-to-end payment needs a funded wallet and has not been exercised by the build agent.

## Hosting

`.openai/hosting.json` declares the retained Site identity, `DB`, and `BUCKET`. Sites applies the checked-in Drizzle migration on publication. Browser QA requires an available browser installation.

Decorative coast photography: Unsplash photo-1473116763249-2faaef81ccda, bundled in `public/images/coast.jpg`. No verdict is assigned to this image.
