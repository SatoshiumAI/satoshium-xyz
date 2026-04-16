// CHECKPOINT: Station #1 Foundation — Miner Sentinel Live (April 2026)
// See docs/checkpoint-station-1-foundation.md before making structural changes.

/**
 * Block Engine — Miner Sentinel Live
 *
 * Manages block types, mock generation, interval utilities, and stage logic.
 * Live data integration lives in live-provider.ts.
 * The useBlockEngine React hook (in home.tsx) wires everything together.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockData = {
  height: number;
  hash: string;
  timestamp: number;        // Unix ms — when the block was found
  intervalSeconds: number;  // Seconds since previous block
  txCount: number;
  totalFeesBTC: number;
  miner: string;            // Pool name, or "Unattributed" / "Pool unknown"
  minerVerified: boolean;   // True only when pool identity is confirmed by data source
  difficulty: string;       // Formatted, e.g., "108.52T"
  hashrate: string;         // Formatted, e.g., "~763 EH/s"
};

/** Lifecycle stage of a newly discovered block, shown in the centerpiece. */
export type ConfirmationStage = "discovery" | "confirmed" | "stable";

/** Data source status for the UI status indicator. */
export type DataSource = "connecting" | "live" | "fallback";

// ─── Mock data ────────────────────────────────────────────────────────────────

const POOL_NAMES = [
  "Foundry USA Pool",
  "AntPool",
  "F2Pool",
  "ViaBTC",
  "Binance Pool",
  "MARA Pool",
  "Luxor",
  "CleanSpark",
];

const DIFFICULTY_VALUES = ["108.52T", "109.14T", "107.88T", "110.21T", "108.93T"];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMockHash(): string {
  const zeros = "0".repeat(randomInt(18, 20));
  const hex = "0123456789abcdef";
  const rest = Array.from({ length: 64 - zeros.length }, () =>
    hex[Math.floor(Math.random() * hex.length)]
  ).join("");
  return zeros + rest;
}

/** Generate a new mock block. Used only in fallback/demo mode. */
export function generateMockBlock(prevHeight: number, intervalSeconds?: number): BlockData {
  const interval = intervalSeconds ?? randomInt(380, 920);
  return {
    height:        prevHeight + 1,
    hash:          generateMockHash(),
    timestamp:     Date.now(),
    intervalSeconds: interval,
    txCount:       randomInt(1800, 4200),
    totalFeesBTC:  parseFloat((Math.random() * 0.45 + 0.08).toFixed(4)),
    miner:         POOL_NAMES[Math.floor(Math.random() * POOL_NAMES.length)],
    minerVerified: false, // Demo data — pool identity is simulated, not confirmed
    difficulty:    DIFFICULTY_VALUES[Math.floor(Math.random() * DIFFICULTY_VALUES.length)],
    hashrate:      `~${randomInt(710, 810)} EH/s`,
  };
}

// ─── Interval utilities ───────────────────────────────────────────────────────

/** Append a new interval and trim to the last 15 entries (oldest first). */
export function appendInterval(current: number[], newVal: number): number[] {
  return [...current.slice(-14), newVal];
}

// ─── Confirmation stage ───────────────────────────────────────────────────────

/**
 * Compute confirmation stage from seconds elapsed since block first appeared.
 *
 * Thresholds (approximate, chosen for booth pacing):
 *   0–12s   → DISCOVERY  — just found, very fresh
 *   12–40s  → CONFIRMED  — propagated across network
 *   40s+    → STABLE     — well-established in the chain
 *
 * FUTURE: Replace with actual confirmation count from a block-status API call.
 */
export function computeStage(secondsElapsed: number): ConfirmationStage {
  if (secondsElapsed < 12) return "discovery";
  if (secondsElapsed < 40) return "confirmed";
  return "stable";
}

// ─── Initial (placeholder) state ──────────────────────────────────────────────
// Displayed briefly while the app fetches live data on first load.
// Replaced immediately when fetchLiveBlockData() resolves.

export const INITIAL_BLOCK: BlockData = {
  height:          892341,
  hash:            "0000000000000000000397a5b3c8d12e4f6789abc1234567890abcdef012345",
  timestamp:       Date.now() - 47_000,
  intervalSeconds: 583,
  txCount:         3421,
  totalFeesBTC:    0.2847,
  miner:           "Foundry USA Pool",
  minerVerified:   false, // Placeholder only — not real data
  difficulty:      "108.52T",
  hashrate:        "~763 EH/s",
};

export const INITIAL_INTERVALS: number[] = [
  427, 621, 889, 543, 312, 1204, 698, 453, 821, 583, 765, 934, 412, 678, 583,
];

export const INITIAL_SIGNALS = {
  blockTiming:        "normal",
  feeLevel:           "normal",
  txLoad:             "normal",
  minerConcentration: "normal",
  mempoolPressure:    "normal",
};

// ─── Mock / fallback engine ───────────────────────────────────────────────────
// Used only when live APIs are unavailable.
//
// WEBSOCKET UPGRADE:
//   Replace this polling pattern with:
//     const ws = new WebSocket("wss://mempool.space/api/v1/ws");
//     ws.onopen = () => ws.send(JSON.stringify({ action: "want", data: ["blocks"] }));
//     ws.onmessage = (e) => { const msg = JSON.parse(e.data); if (msg.block) onNewBlock(...); }
//   WebSocket provides instant notification with no polling lag.
//
// BLOCKSTREAM ALTERNATIVE:
//   REST polling against https://blockstream.info/api/blocks/tip/hash

const MOCK_BLOCK_INTERVAL_MS = 45_000;

export function startMockBlockEngine(
  onNewBlock: (block: BlockData, intervalSeconds: number) => void
): () => void {
  const timer = setInterval(() => {
    const isSlowBlock = Math.random() < 0.2;
    const intervalSec = isSlowBlock ? randomInt(700, 1100) : randomInt(380, 680);
    onNewBlock(
      generateMockBlock(0, intervalSec),
      intervalSec
    );
  }, MOCK_BLOCK_INTERVAL_MS);

  return () => clearInterval(timer);
}
