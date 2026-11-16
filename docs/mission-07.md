# Lensy — Mission 07: Verified Media Lens

## Overview
A consumer tool that checks images and videos for AI generation or manipulation. Users upload media, the app buys verification through Telegraph, and shows the verdict with the exact cost and a clickable receipt. Users can share a public link so others can see the same proof without triggering a new purchase.

**Name:** Lensy  
**Mission:** [Mission 07 — Consumer Platform](https://hackathon.telegraphprotocol.com/missions/consumer-platform)  
**Track:** Apps & Agents  
**Goal:** Consumer experience where a lens buys a verified answer in the moment, with the price and the proof visible to the user.

## Problem
Consumer platforms are flooded with synthetic content. Verification is either invisible, expensive, or not shareable. There is no simple tool that makes the cost and the cryptographic proof of a media check visible and reusable.

## Solution
Lensy:
1. User uploads an image or video (or pastes a link).
2. App fires parallel Telegraph requests for media verification (and optional captioning).
3. Result screen shows verdict, confidence, exact cost, and clickable receipt(s).
4. User can generate a shareable public link. Anyone opening it sees the same result and receipt without a new purchase.
5. Optional public feed of recent shared checks.

## Architecture

```
[User Upload / Link]
        ↓
[Lensy Backend]
   ├── Parallel Telegraph requests
   │     • MEDIA_FORENSIC_VERIFY
   │     • IMAGE_CAPTIONING (optional)
   ├── Receipt aggregation
   └── Verdict + cost assembly
        ↓
[Result Page]
   - Verdict + confidence
   - Exact cost
   - Clickable receipts
   - “Share” button → public link
        ↓
[Public Share Page]
   - Same result + receipts (no new purchase)
   - Optional public feed of recent shares
```

## Core Components

### 1. Upload / Input
- Drag-and-drop or file picker for images and short videos.
- Optional URL paste.
- Size and type limits for the MVP.

### 2. Verification Agent
- On upload, fire parallel Telegraph requests for the relevant Intents.
- Collect ranked answers + receipts.
- Assemble a simple result object: `{verdict, confidence, caption, cost, receipts[]}`.

### 3. Result Page
- Clear verdict (e.g. “Likely AI-generated”, “No strong signals of manipulation”).
- Confidence score.
- Exact cost of the check(s).
- Clickable receipt links (explorer or raw receipt).
- “Share” button that generates a public URL.

### 4. Public Share Page
- Same result and receipts, loaded from stored data.
- No new Telegraph purchase is triggered.
- Optional “Verified with Lensy” badge and link back.

### 5. Optional Public Feed
- Simple gallery or list of recent shared checks (opt-in).
- Gives ongoing evidence for judges and content for posts.

## Key Intents
- `MEDIA_FORENSIC_VERIFY` (primary)
- `IMAGE_CAPTIONING` (optional, parallel)
- Additional media or fact-check intents as available

## Tech Stack (recommended)
- **Frontend:** Next.js or simple React (upload + result + share pages)
- **Backend:** Node.js / TypeScript
- **Telegraph:** Official SDK or x402 payment flow
- **Storage:** Lightweight DB or JSON + object storage for uploads and results
- **Hosting:** Vercel or Railway
- **Receipts:** Store receipt hashes / explorer links with each result

## Build Priority (MVP first)
1. Upload endpoint + basic UI.
2. Parallel Telegraph request layer for `MEDIA_FORENSIC_VERIFY`.
3. Result page showing verdict, cost, and receipts.
4. Shareable public link (store result, serve without re-purchase).
5. Optional public feed of recent shares.
6. (Later) History for logged-in users, API access, bulk upload.

## Demo Script
- Upload a known AI-generated image and a real photo.
- Show both results side-by-side with costs and clickable receipts.
- Generate a shareable link and open it in another tab or browser.
- Show the public feed of recent checks.
- Highlight total spend and number of shared receipts.

## Scoring Alignment
- **Commercial viability:** Clear user (anyone checking media). Path from free tool to paid API / higher volume.
- **Technical quality:** Parallel purchases, receipts, shareable proof without re-purchase.
- **Organic growth:** Shared links and public feed are natural content. Easy to post examples.
- **Telegraph integration:** Continuous genuine machine-to-machine purchases with visible cost.

## Links
- Mission page: https://hackathon.telegraphprotocol.com/missions/consumer-platform
- How it works: https://hackathon.telegraphprotocol.com/how-it-works
- Rules: https://hackathon.telegraphprotocol.com/rules
- Docs: https://docs.telegraphprotocol.com/
- Intent catalogue: https://hackathon.telegraphprotocol.com/intents
- Bounties: https://github.com/telegraphprotocol/bounties

## Next Steps
1. Register for Season II (Apps & Agents track) and pick Mission 07.
2. Set up upload + Telegraph request flow.
3. Log the first real receipts.
4. Build the result page and shareable link.
5. Ship a demoable version before the integration milestone.
