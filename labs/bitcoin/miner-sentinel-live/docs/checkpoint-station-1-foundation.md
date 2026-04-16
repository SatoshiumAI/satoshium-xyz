# Miner Sentinel Live — Station #1 Foundation Checkpoint

**Project:** Miner Sentinel Live  
**Station:** #1 — "Birth of a Bitcoin" (part of "The Life of a Bitcoin" guided experience)  
**Checkpoint name:** Station #1 Foundation  
**Checkpoint date:** April 2026  
**Git reference:** `b2f0925` — "Improve live data insights for Bitcoin network monitoring"

---

## What this checkpoint is

This is the official stable return point for Station #1 of the Bitcoin Conference kiosk experience. The build is fully functional, connected to live Bitcoin mainnet data, and conference-safe. No further work is needed before resuming from here.

When returning to this project, start from this checkpoint and do not re-implement any of the items listed under "Already completed" below.

---

## Already completed (do not re-implement)

### Layout and visual design
- Full-screen 1920×1080 dark OLED kiosk layout — no scrolling, no overflow
- Cyan/teal primary accent (`--primary`) on black/near-black background
- Monospace font throughout all data fields and labels
- No emojis anywhere in the UI
- Header: station name, title, live clock, data source badge
- Alert strip: contextual state messages (new block / demo mode / nominal / connecting)
- Narrative band: Origin → Discovery → Signal → Visibility
- Three-column stat grid: Block Height, Time Since Found, Block Interval, Block Hash (full width), Tx Count, Total Fees, Miner/Pool
- Block Discovery Signal centerpiece (right column): block height, seconds ago, animated signal bars, confirmation stage indicator, scanning label
- Integrity Signals panel (right column, below centerpiece): five live-computed signals
- Signal Insight rotating fact strip (above timeline)
- Recent Block Intervals chart (Recharts bar chart, color-coded by duration)
- Footer: "Mining is observable behavior."

### Live data integration
- Connected to **mempool.space public REST API** (CORS-enabled, no API key required)
- Endpoint used: `GET https://mempool.space/api/v1/blocks` — fetches 16 most recent blocks per call
- Tip polling: `GET https://mempool.space/api/v1/blocks/tip/hash` every 30 seconds
- On hash change: full block fetch triggered → `handleNewBlock()` fires

### Fields that are live (from API)
| Field | Source |
|---|---|
| Block height | `blocks[0].height` |
| Block hash | `blocks[0].id` |
| Block timestamp / seconds ago | `blocks[0].timestamp × 1000` |
| Transaction count | `blocks[0].tx_count` |
| Total fees (BTC) | `blocks[0].extras.totalFees ÷ 1e8` |
| Block interval (seconds) | `blocks[0].timestamp − blocks[1].timestamp` |
| Recent intervals (timeline) | Computed from 16 blocks, oldest-first |
| Pool name / miner attribution | `blocks[0].extras.pool.name` (null-safe) |
| Network difficulty | `blocks[0].difficulty` (formatted as T/P) |
| Recent pool names (concentration) | `blocks[0..14].extras.pool.name` |

### Fields that are estimated
| Field | Method |
|---|---|
| Network hashrate | Computed: `difficulty × 2³² ÷ 600 ÷ 1e18` EH/s |

### Block event system
- `useBlockEngine()` React hook manages all state
- Boot sequence: connecting → live (mempool.space) or fallback (mock, 45s intervals)
- `handleNewBlock()` fires for both live and mock new blocks
- `isNewBlock` flag: true for 3 seconds, triggers alert strip + card glows
- `secondsAgo` updates every 1 second via a ticker ref (no stale closure)
- `confirmationStage`: Discovery (0–12s) → Confirmed (12–40s) → Stable (40s+)
- Active stage rendered with background pill + ring for distance readability

### Data honesty
- `minerVerified: boolean` on `BlockData` — only true when `extras.pool.name` is present
- "Identity confirmed" badge shown only when `minerVerified` is true
- Unresolved miners display "Not resolved" in muted text
- Fallback mode clearly labeled "Demo Mode" in header badge and alert strip

### Integrity signals (live-computed from `computeSignals()`)
| Signal | Method |
|---|---|
| Block Timing | Current interval vs. rolling average of recent intervals; flags Slow / Fast |
| Fee Level | `totalFeesBTC × 1e8 ÷ txCount` sat/tx vs. absolute thresholds |
| Tx Load | `txCount` vs. absolute thresholds (Low < 1000 < Normal < 3800 < High) |
| Pool Concentration | Dominant pool share of resolved recent miners; flags Watch at ≥ 30% |
| Mempool Pressure | Static "Normal" — marked for future upgrade |

### Graceful fallback
- Live boot failure → `dataSource = "fallback"` → mock block engine starts
- Mock engine: new block every 45 seconds, random but realistic data
- UI indicates fallback via amber "Demo Mode" badge (header) and alert strip
- No raw errors, no broken layout, no visible debugging text

### Architecture separation
- `src/lib/live-provider.ts` — pure async API functions, no React dependency
- `src/lib/block-engine.ts` — types, mock generator, interval utilities, stage logic
- `src/pages/home.tsx` — all React, `useBlockEngine` hook, component tree
- All LIVE DATA integration points and future upgrade paths documented in comments

---

## What should NOT be changed when resuming

- **Do not change the Tailwind color scheme** — `hsl(var(--primary))` is the cyan/teal accent throughout. Changing this breaks cards, badges, charts, and signals simultaneously.
- **Do not add layout-shifting animations** — all live counters use `tabular-nums` + fixed-height containers. The `BAR_HEIGHTS` array is pre-computed once at module load.
- **Do not replace `AnimatePresence` wrappers with direct renders** — the fade transitions on `FadeValue` depend on `AnimatePresence mode="wait"` being inside a fixed-height parent.
- **Do not change the mempool.space polling interval below 20 seconds** — lower values may trip rate limits at a conference venue.
- **Do not add `isAnimationActive` to the Recharts bar chart** — it is intentionally disabled (`isAnimationActive={false}`) to prevent re-animation on every 1-second state tick.
- **Do not remove `blockRef` and `arrivalRef` from `useBlockEngine`** — they exist to prevent stale closures in the 1-second ticker and are load-bearing.

---

## WebSocket upgrade path (not yet implemented)

The current polling approach works well for a conference booth. When ready to upgrade:

```ts
// In useBlockEngine, replace the 30s polling interval with:
const ws = new WebSocket("wss://mempool.space/api/v1/ws");
ws.onopen = () => ws.send(JSON.stringify({ action: "want", data: ["blocks"] }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.block) {
    // Transform msg.block to BlockData and call handleNewBlock()
  }
};
```

This gives instant block notification with no polling lag.

---

## Future signals not yet wired (data available, implementation pending)

- **Mempool Pressure**: `GET https://mempool.space/api/mempool` → `{ count, vsize, fee_histogram }`. Classify by count: < 10k = Low, 10k–50k = Normal, > 50k = Elevated.
- **Fee Anomaly**: Compare `avgFeeRate` across recent blocks against rolling mean. Available in `extras.avgFeeRate` (sat/vbyte) from the blocks endpoint.
- **Richer pool attribution**: `extras.coinbaseRaw` + `extras.matchRate` available from mempool.space for fingerprint-based verification.

---

## Next likely phase when resuming

### For Bitcoin Conference 2027 mode

1. **Deployment under Satoshium**  
   Target path: `/labs/miner-sentinel-live/` or similar Satoshium subdomain.  
   The Vite `base` config will need updating if mounted at a non-root path.  
   Current `vite.config.ts` uses `base: "/"` — verify this before deployment.

2. **Conference kiosk mode hardening**  
   - Lock scroll: already done (`overflow: hidden` on root)  
   - Disable right-click context menu for kiosk browsers  
   - Add auto-reload every 6–12 hours to clear memory leaks on long-running displays  
   - Test on actual display hardware at 1920×1080 in a bright venue environment

3. **Attract mode**  
   If the display sits unattended, a subtle attract sequence could cycle through recent block discoveries automatically. Consider a slow full-screen "block found" flash every N seconds when no real block has arrived in > 15 minutes.

4. **Conference signage and copy pass**  
   Review all visible UI text for conference-appropriate wording. Current copy is functional but could be tightened for a general audience who may not know Bitcoin terminology.

5. **Lightweight visitor interaction (optional)**  
   A single tap/click anywhere could trigger a "what is this number?" overlay explaining the current block height or hash. Designed to be dismissible and non-intrusive.

6. **Station #2 and beyond**  
   This station ("Birth of a Bitcoin") is #1 in the "Life of a Bitcoin" guided experience. Future stations could cover mempool pressure, transaction confirmation, UTXO lifecycle, and the Lightning Network layer.

7. **"The Life of a Bitcoin" multi-station coordinator**  
   When all stations exist, a shared state layer (localStorage or BroadcastChannel) could synchronize the highlighted block across all stations simultaneously when a new block arrives.

---

## File map (key files at this checkpoint)

```
artifacts/miner-sentinel/
├── src/
│   ├── lib/
│   │   ├── block-engine.ts        Types, mock engine, stage logic, initial data
│   │   └── live-provider.ts       mempool.space API calls, parsing, formatting
│   ├── pages/
│   │   └── home.tsx               All React: hook, components, root page
│   ├── App.tsx                    Router (single route: Home)
│   └── index.css                  Global styles, Tailwind config, shimmer animation
├── docs/
│   └── checkpoint-station-1-foundation.md   This file
├── package.json
└── vite.config.ts
```

---

## How to refer to this version

When resuming work, say:

> "Resume from the Station #1 Foundation checkpoint of Miner Sentinel Live."

The git commit tagged to this state is **`b2f0925`** — "Improve live data insights for Bitcoin network monitoring."

All of the above is in place and working. The dashboard is production-quality for a conference booth environment as of this checkpoint.
