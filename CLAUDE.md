# CLAUDE.md

## Project overview

MeshCore Private Key Generator — a browser-based tool for generating MeshCore-compatible Ed25519 private keys (64-byte / 128-hex format) with optional vanity public-key prefix matching. Runs entirely client-side using libsodium WebAssembly in workers for the search loop and native WebCrypto for export/validation.

## Tech stack

- React 19 + Vite 8 (JSX, no TypeScript)
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- ESLint with React hooks and refresh plugins
- Vitest for unit tests (colocated `*.test.js` files in `src/lib/`)

## Project structure

```
src/
  App.jsx                    # Root component, state management, worker pool lifecycle
  main.jsx                   # React entry point
  index.css                  # Tailwind import
  lib/
    crypto.js                # Hex/bytes conversion, clamping, prefix matching, candidate creation, validation
    crypto.test.js           # Vitest coverage for crypto helpers
    funkyPrefixes.js         # Curated leet-speak hex presets + random pick / preview helpers
    funkyPrefixes.test.js    # Vitest coverage for prefix curation and preview rendering
    liveStats.js             # Search-progress math: rate, ETA, find-probability, display formatting
    liveStats.test.js        # Vitest coverage for liveStats formatters and metrics
    searchWorker.js          # Module worker search loop backed by libsodium-wrappers
    workerPool.js            # Reusable module-worker pool with readiness prewarming
  components/
    SearchSettings.jsx       # Hex prefix input, live preview, preset gallery, advanced worker/batch config
    LiveStats.jsx            # Attempts, throughput, elapsed time, ETA, progress bar
    ResultPanel.jsx          # Public key, MeshCore private key (128 hex), seed, PKCS8, copy buttons
public/
  favicon.svg                # App favicon
index.html                   # HTML shell
```

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm test` - Run Vitest once
- `npm run test:watch` - Run Vitest in watch mode

## Architecture notes

- Core crypto utilities in `src/lib/crypto.js`, worker pool management in `src/lib/workerPool.js`
- `App.jsx` contains root state and orchestrates search lifecycle

### MeshCore key format
1. Generate 32-byte Ed25519 seed via WebCrypto
2. SHA-512(seed) → 64 bytes
3. Clamp first 32 bytes: `byte[0] &= 248`, `byte[31] &= 63`, `byte[31] |= 64`
4. Final key: `[32 clamped bytes][32 remaining bytes]` = 128 hex chars

### Worker pool
- Uses reusable module workers (`src/lib/searchWorker.js`) bundled by Vite
- Workers prewarm `libsodium-wrappers` on initialization so the first search starts hot
- Each worker runs a synchronous batched search loop over random 32-byte seeds and posts progress updates plus immediate match results
- Match finalization, PKCS#8 export, and validation stay on the main thread via WebCrypto
- Pool is persistent and reused between search runs

### Prefix matching
- Matches against raw 32-byte public key bytes
- Accepts 1-8 lowercase hex chars (up to 4 bytes); odd lengths are matched at hex granularity
- Blocks reserved prefixes starting with `00` or `FF`
- `funkyPrefixes.js` ships a curated leet-speak preset gallery (e.g. `cafe`, `deadbeef`) surfaced in `SearchSettings`

### Validation
- Verifies key lengths, clamp bits, reserved prefix exclusion
- Sign/verify round-trip test using PKCS#8 reimport

## Maintenance

- Keep this CLAUDE.md up to date when important architectural changes are made or new key features are added
