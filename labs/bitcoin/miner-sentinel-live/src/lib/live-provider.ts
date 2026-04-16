// CHECKPOINT: Station #1 Foundation — Miner Sentinel Live (April 2026)
// See docs/checkpoint-station-1-foundation.md before making structural changes.

/**
 * Live Provider — Miner Sentinel Live
 *
 * Connects to mempool.space public API (CORS-enabled, no API key required).
 * All functions are pure async — no React, no side-effects, no state.
 *
 * API source: https://mempool.space/api
 * Docs:       https://mempool.space/docs/api/rest
 *
 * UPGRADE PATHS (marked below):
 *   WEBSOCKET: Replace polling with wss://mempool.space/api/v1/ws
 *              Send: {"action":"want","data":["blocks"]}
 *              Listen for: {"block": {...}} messages
 *   BLOCKSTREAM: Alternative REST source at https://blockstream.info/api
 *                Same interval-polling approach, slightly different field names
 */

import type { BlockData } from "./block-engine";

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMPOOL_BASE = "https://mempool.space/api";
const FETCH_TIMEOUT_MS = 9_000;

// ─── Raw API types ────────────────────────────────────────────────────────────

interface MempoolPool {
  id?: number;
  name?: string;
  slug?: string;
}

interface MempoolBlockExtras {
  totalFees?: number;   // satoshis
  reward?: number;      // satoshis (subsidy + fees)
  pool?: MempoolPool;
  medianFee?: number;   // sat/vbyte
  avgFeeRate?: number;  // sat/vbyte
  // FUTURE: matchRate, coinbaseRaw for deeper pool attribution
}

interface MempoolApiBlock {
  id: string;           // block hash
  height: number;
  timestamp: number;    // unix seconds
  tx_count: number;
  difficulty: number;   // raw difficulty as float
  extras?: MempoolBlockExtras;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(id));
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Format raw Bitcoin difficulty as a human-readable string, e.g., "108.52T". */
export function formatDifficulty(d: number): string {
  if (d >= 1e15) return `${(d / 1e15).toFixed(2)} P`;
  if (d >= 1e12) return `${(d / 1e12).toFixed(2)} T`;
  if (d >= 1e9)  return `${(d / 1e9).toFixed(2)} G`;
  return `${(d / 1e6).toFixed(2)} M`;
}

/**
 * Estimate network hashrate from difficulty.
 * Formula: hashrate (H/s) = difficulty × 2^32 / target_block_seconds
 * Target block time: 600 seconds
 * Result formatted as EH/s.
 */
export function estimateHashrate(difficulty: number): string {
  const hashesPerSecond = (difficulty * 4_294_967_296) / 600;
  const ehPerSecond = hashesPerSecond / 1e18;
  return `~${Math.round(ehPerSecond)} EH/s`;
}

// ─── Pool attribution ─────────────────────────────────────────────────────────

/**
 * Resolve pool name and verified status from block extras.
 * Returns null for name when attribution is unavailable.
 *
 * FUTURE: Supplement with Blockstream coinbase decode or
 *         custom pool fingerprint database for deeper attribution.
 */
function resolvePool(extras?: MempoolBlockExtras): { name: string; verified: boolean } {
  const poolName = extras?.pool?.name?.trim();
  if (poolName && poolName.length > 0) {
    return { name: poolName, verified: true };
  }
  return { name: "Unattributed", verified: false };
}

// ─── Interval calculation ─────────────────────────────────────────────────────

/**
 * Compute inter-block intervals from a newest-first array of blocks.
 * Returns intervals oldest-first so the timeline chart reads left→right.
 */
function computeIntervals(blocks: MempoolApiBlock[]): number[] {
  const intervals: number[] = [];
  for (let i = 0; i < blocks.length - 1; i++) {
    intervals.push(blocks[i].timestamp - blocks[i + 1].timestamp);
  }
  return intervals.reverse(); // oldest first
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch just the current tip hash for polling.
 * Cheap call (~50 bytes response).
 *
 * WEBSOCKET: Replace this polling call with a WebSocket subscription.
 * Endpoint:  wss://mempool.space/api/v1/ws
 * Protocol:  {"action":"want","data":["blocks"]}
 */
export async function fetchLiveTipHash(): Promise<string> {
  const res = await fetchWithTimeout(`${MEMPOOL_BASE}/v1/blocks/tip/hash`, 5_000);
  if (!res.ok) throw new Error(`Tip hash fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  return text.trim();
}

/**
 * Fetch recent blocks and return parsed BlockData for the latest block
 * plus the last 15 inter-block intervals.
 *
 * Live fields:    height, hash, timestamp, tx_count, totalFees, pool name
 * Estimated:      hashrate (computed from difficulty)
 * Not available:  mempool pressure, fee anomaly signals (separate endpoints)
 *
 * FUTURE MEMPOOL PRESSURE:
 *   GET /api/mempool → { count, vsize, total_fee, fee_histogram }
 *   Use `count` and `fee_histogram` to derive mempoolPressure signal.
 *
 * FUTURE FEE ANOMALY:
 *   Compare extras.avgFeeRate across recent blocks against a rolling mean.
 */
export async function fetchLiveBlockData(): Promise<{ block: BlockData; intervals: number[] }> {
  const res = await fetchWithTimeout(`${MEMPOOL_BASE}/v1/blocks`);
  if (!res.ok) throw new Error(`Blocks fetch failed: HTTP ${res.status}`);

  const raw: MempoolApiBlock[] = await res.json();

  if (!raw || raw.length < 2) {
    throw new Error("Insufficient block data in API response");
  }

  const latest = raw[0];
  const prev   = raw[1];

  const intervalSeconds = latest.timestamp - prev.timestamp;
  const { name: minerName, verified: minerVerified } = resolvePool(latest.extras);

  const totalFeesBTC = latest.extras?.totalFees != null
    ? parseFloat((latest.extras.totalFees / 1e8).toFixed(4))
    : 0;

  const difficulty = latest.difficulty ?? 0;

  const block: BlockData = {
    height:        latest.height,
    hash:          latest.id,
    timestamp:     latest.timestamp * 1000, // API returns unix seconds → convert to ms
    intervalSeconds,
    txCount:       latest.tx_count,
    totalFeesBTC,
    miner:         minerName,
    minerVerified,
    difficulty:    difficulty > 0 ? formatDifficulty(difficulty) : "Unknown",
    hashrate:      difficulty > 0 ? estimateHashrate(difficulty) : "—",
  };

  const intervals = computeIntervals(raw.slice(0, 16)); // up to 15 intervals from 16 blocks

  // Collect pool names oldest→newest for concentration analysis.
  // Unresolved pools are stored as empty string so callers can filter them.
  const recentMiners: string[] = raw
    .slice(0, 15)
    .map((b) => b.extras?.pool?.name?.trim() ?? "")
    .reverse();

  return { block, intervals, recentMiners };
}
