# Lensy

A media verification workspace built from `../lensy-mission-07.md`. React, TypeScript, Vinext (Next.js App Router), Cloudflare D1 for results, and R2 for uploaded files.

## Run locally

```sh
npm ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_<generated-name>.sql
npm run dev
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. Apply the actual generated migration filename. The preview starts at `http://localhost:5173`. Local state persists under ignored `.wrangler/state/`.

## Behavior

- Upload JPG, PNG, WebP, MP4, or WebM up to 20 MB, or save a direct HTTPS media URL.
- Demo uploads are stored with an **inconclusive, unanalyzed** result. Samples are clearly illustrative; no fabricated receipts or charges.
- My checks is scoped to the authenticated Site user, or an HttpOnly anonymous session cookie. Only shared checks are readable by other sessions. Shared media follows the result's access rules.
- Share links read stored results and never call Telegraph. Adding to the feed is explicit opt-in; results can be unlisted.
- Download reports as JSON and inspect raw payment receipts.
- Responsive interface, keyboard focus, dialog focus containment, reduced-motion support, and status messages.

## Telegraph live mode

Choose **Live network** from the workspace selector or wallet dialog. Use an Ethereum wallet browser extension with funded **Telegraph escrow on Sepolia**. Lensy does not store or ask for wallet private keys. Funding instructions: https://anjoman.ai/docs/using/escrow-inference

Live checks currently require a **public HTTPS media URL**. Uploaded files remain demo-only because the privately hosted Site cannot make uploads publicly accessible to external providers.

The backend discovers the current schemas for `MEDIA_FORENSIC_VERIFY_GENERAL` and optional `IMAGE_CAPTIONING_GENERAL`, then obtains a 402 escrow quote. The exact price is displayed before any signature. Each request is signed using the network's verbatim EIP-191 message template, a fresh nonce, and a validity window under two minutes. Paid requests run in parallel. A database state transition prevents submitting the same quote twice.

Results retain provider answers, reported costs, and original payment receipts. Epoch proof URLs use the actual receipt hash and epoch; a finalized proof may not exist until the epoch settles. Raw, rejected, or absent fields do not become confident verdicts. Provider outages and partial failures are displayed. A lost connection after payment requires inspecting the stored check and network ledger; no automatic purchase retry occurs.

**Live payments require a funded wallet and have not been exercised by the build agent.** Discovery and quote contracts follow the live official documentation. No paid calls are made by demo mode or shared result reads.

## Validate

```sh
node node_modules/typescript/bin/tsc --noEmit
node tests/integration.mjs
```

The integration script needs the running local preview and creates a test check. It verifies upload validation, private access, sharing, media permissions, feed opt-in/unlisting, cross-origin write protection, and the share page.

## Hosting

`.openai/hosting.json` retains the Site identity and declares `DB` and `BUCKET`. Sites applies generated Drizzle migrations during publication. The Site starts owner-private, so hosted links are subject to that access policy even after sharing within Lensy.

Sample photography: Unsplash, bundled in `public/images`. Coast: photo-1473116763249-2faaef81ccda; portrait: photo-1534528741775-53994a69daeb; city: photo-1519608487953-e999c86e7455.
