// CHECKPOINT: Station #1 Foundation — Miner Sentinel Live (April 2026)
// See docs/checkpoint-station-1-foundation.md before making structural changes.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cpu,
  Database, Hash, Layers, ShieldCheck, Zap, Copy, Check,
  Sparkles, Signal, WifiOff,
} from "lucide-react";
import {
  INITIAL_BLOCK,
  INITIAL_INTERVALS,
  appendInterval,
  computeStage,
  startMockBlockEngine,
  type BlockData,
  type ConfirmationStage,
  type DataSource,
} from "@/lib/block-engine";
import {
  fetchLiveTipHash,
  fetchLiveBlockData,
} from "@/lib/live-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, ReferenceLine,
} from "recharts";

// ─── SIGNAL INSIGHTS ─────────────────────────────────────────────────────────
const SIGNAL_INSIGHTS = [
  "Every ~10 minutes, a miner discovers a valid block hash and earns the block reward.",
  "The block hash must begin with many zeros — finding it requires trillions of guesses per second.",
  "Transaction fees are paid by senders and collected by the winning miner as extra income.",
  "A block's timestamp is set by the miner, but the network enforces it stays within 2 hours of reality.",
  "Pool mining means thousands of miners share the work — and split the reward proportionally.",
  "Bitcoin adjusts mining difficulty every 2,016 blocks to keep the average block time near 10 minutes.",
  "A mempool holds unconfirmed transactions waiting to be included in the next block.",
  "The block interval is never exactly 10 minutes — it is a statistical average governed by randomness.",
  "Miners prioritize transactions with higher fees when selecting what to include in a block.",
  "Once confirmed by six subsequent blocks, a transaction is considered effectively irreversible.",
];

// ─── SIGNAL COMPUTATION ───────────────────────────────────────────────────────

type SignalStatus = "normal" | "slow" | "fast" | "elevated" | "high" | "low" | "watch";

type SignalSet = {
  blockTiming:        { status: SignalStatus; description: string };
  feeLevel:           { status: SignalStatus; description: string };
  txLoad:             { status: SignalStatus; description: string };
  minerConcentration: { status: SignalStatus; description: string };
  mempoolPressure:    { status: SignalStatus; description: string };
};

/**
 * Derive integrity signal statuses from live block + interval history.
 *
 * Block Timing:        current interval vs rolling average of recent intervals
 * Fee Level:          fee-per-tx in satoshis vs absolute thresholds
 * Tx Load:            block.txCount vs absolute thresholds
 * Pool Concentration: dominant pool share of recent recentMiners (resolved only)
 * Mempool Pressure:   static — requires separate GET /api/mempool call (FUTURE)
 */
function computeSignals(
  block: BlockData,
  intervals: number[],
  recentMiners: string[]
): SignalSet {
  // ── Block Timing ────────────────────────────────────────────────────────────
  const avgInterval =
    intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : 600;
  const avgMin = Math.floor(avgInterval / 60);
  const avgSec = avgInterval % 60;
  const avgLabel = `${avgMin}m ${String(avgSec).padStart(2, "0")}s`;

  let blockTimingStatus: SignalStatus = "normal";
  let blockTimingDesc = `Current interval ${formatInterval(block.intervalSeconds)} — near the recent average of ${avgLabel}.`;
  if (block.intervalSeconds > Math.max(avgInterval * 1.55, 900)) {
    blockTimingStatus = "slow";
    blockTimingDesc = `Slower than usual — ${formatInterval(block.intervalSeconds)} vs recent avg ${avgLabel}.`;
  } else if (block.intervalSeconds < Math.min(avgInterval * 0.55, 240)) {
    blockTimingStatus = "fast";
    blockTimingDesc = `Faster than usual — ${formatInterval(block.intervalSeconds)} vs recent avg ${avgLabel}.`;
  }

  // ── Fee Level ───────────────────────────────────────────────────────────────
  const feePerTx =
    block.txCount > 0 ? (block.totalFeesBTC * 1e8) / block.txCount : 0;
  let feeLevelStatus: SignalStatus = "normal";
  let feeLevelDesc = `${Math.round(feePerTx).toLocaleString()} sat/tx — within the normal range.`;
  if (feePerTx > 7000) {
    feeLevelStatus = "elevated";
    feeLevelDesc = `${Math.round(feePerTx).toLocaleString()} sat/tx — above typical levels.`;
  } else if (feePerTx > 0 && feePerTx < 400) {
    feeLevelStatus = "low";
    feeLevelDesc = `${Math.round(feePerTx).toLocaleString()} sat/tx — below typical levels.`;
  }

  // ── Tx Load ─────────────────────────────────────────────────────────────────
  let txLoadStatus: SignalStatus = "normal";
  let txLoadDesc = `${block.txCount.toLocaleString()} transactions — within expected range.`;
  if (block.txCount > 3800) {
    txLoadStatus = "high";
    txLoadDesc = `${block.txCount.toLocaleString()} transactions — approaching block capacity.`;
  } else if (block.txCount < 1000) {
    txLoadStatus = "low";
    txLoadDesc = `${block.txCount.toLocaleString()} transactions — below typical volume.`;
  }

  // ── Pool Concentration ──────────────────────────────────────────────────────
  const resolvedMiners = recentMiners.filter((m) => m.length > 0);
  let minerConcentrationStatus: SignalStatus = "normal";
  let minerConcentrationDesc = "No unusual pool dominance detected in recent blocks.";
  if (resolvedMiners.length >= 5) {
    const counts: Record<string, number> = {};
    for (const m of resolvedMiners) counts[m] = (counts[m] ?? 0) + 1;
    const [topPool, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const pct = Math.round((topCount / resolvedMiners.length) * 100);
    if (pct >= 30) {
      minerConcentrationStatus = "watch";
      minerConcentrationDesc = `${topPool} accounts for ${pct}% of recent attributed blocks.`;
    } else {
      minerConcentrationDesc = `${topPool} is the most active pool at ${pct}% of recent blocks.`;
    }
  } else if (resolvedMiners.length === 0) {
    minerConcentrationDesc = "Pool attribution unavailable — coinbase data not resolved.";
  }

  return {
    blockTiming:        { status: blockTimingStatus,        description: blockTimingDesc        },
    feeLevel:           { status: feeLevelStatus,           description: feeLevelDesc           },
    txLoad:             { status: txLoadStatus,             description: txLoadDesc             },
    minerConcentration: { status: minerConcentrationStatus, description: minerConcentrationDesc },
    // FUTURE MEMPOOL PRESSURE: GET https://mempool.space/api/mempool
    //   { count, vsize, total_fee, fee_histogram }
    //   Classify by count (>50k = elevated) and fee_histogram shape.
    mempoolPressure: {
      status:      "normal",
      description: "Live mempool depth not yet connected — requires additional API call.",
    },
  };
}

// ─── CONFIRMATION STAGE CONFIG ────────────────────────────────────────────────
const STAGE_CONFIG: Record<ConfirmationStage, { label: string; active: string; inactive: string }> = {
  discovery: { label: "Discovery", active: "text-primary font-bold",       inactive: "text-muted-foreground/25" },
  confirmed: { label: "Confirmed", active: "text-primary/70 font-semibold", inactive: "text-muted-foreground/25" },
  stable:    { label: "Stable",    active: "text-green-400/80 font-medium", inactive: "text-muted-foreground/25" },
};
const STAGE_ORDER: ConfirmationStage[] = ["discovery", "confirmed", "stable"];

// ─── DATA SOURCE CONFIG ───────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<DataSource, { label: string; color: string; dotClass: string; Icon: React.ElementType }> = {
  connecting: { label: "Connecting",   color: "text-muted-foreground/60", dotClass: "bg-muted-foreground/40", Icon: Signal  },
  live:       { label: "Mainnet Live", color: "text-primary",             dotClass: "bg-primary",             Icon: Signal  },
  fallback:   { label: "Demo Mode",    color: "text-amber-400/80",        dotClass: "bg-amber-400/70",        Icon: WifiOff },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function truncateHash(hash: string, head = 16, tail = 12) {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

function formatSecondsAgo(sec: number) {
  if (sec < 60) return `${String(sec).padStart(2, "0")}s ago`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s ago`;
}

function formatInterval(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `~${m}m ${s}s`;
}

// ─── BLOCK ENGINE HOOK ────────────────────────────────────────────────────────
/**
 * Manages all block state with automatic live/fallback switching.
 *
 * Boot sequence:
 *  1. Render with placeholder INITIAL_BLOCK while connecting
 *  2. Attempt fetchLiveBlockData() against mempool.space
 *  3a. Success → replace state with live data, poll tip hash every 30s
 *  3b. Failure → set dataSource = "fallback", start mock engine
 *
 * New block dispatch (live mode):
 *  - Poll /v1/blocks/tip/hash every 30 seconds
 *  - On hash change, fetch full /v1/blocks and call handleNewBlock()
 *
 * WEBSOCKET UPGRADE:
 *  Replace the 30s polling interval with:
 *    const ws = new WebSocket("wss://mempool.space/api/v1/ws");
 *    ws.onopen = () => ws.send(JSON.stringify({ action: "want", data: ["blocks"] }));
 *    ws.onmessage = (e) => { const msg = JSON.parse(e.data); if (msg.block) handleNewBlock(...) }
 */
function useBlockEngine() {
  const [block, setBlock] = useState<BlockData>(INITIAL_BLOCK);
  const [intervals, setIntervals] = useState<number[]>(INITIAL_INTERVALS);
  const [isNewBlock, setIsNewBlock] = useState(false);
  const [confirmationStage, setConfirmationStage] = useState<ConfirmationStage>(
    computeStage(Math.floor((Date.now() - INITIAL_BLOCK.timestamp) / 1000))
  );
  const [secondsAgo, setSecondsAgo] = useState(
    Math.floor((Date.now() - INITIAL_BLOCK.timestamp) / 1000)
  );
  const [dataSource, setDataSource] = useState<DataSource>("connecting");
  const [recentMiners, setRecentMiners] = useState<string[]>([]);

  // Refs let the 1s ticker and async callbacks read current values without
  // stale closures or excessive re-subscriptions.
  const blockRef      = useRef<BlockData>(INITIAL_BLOCK);
  const arrivalRef    = useRef<number>(INITIAL_BLOCK.timestamp);
  const newBlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTipRef = useRef<string>(INITIAL_BLOCK.hash);

  /**
   * Central handler for any new block — live or mock.
   * `newIntervals` is passed from live fetches (full updated history).
   * When absent, we append one entry to the existing intervals list.
   */
  const handleNewBlock = useCallback(
    (
      newBlock: BlockData,
      intervalSec: number,
      newIntervals?: number[],
      newMiners?: string[]
    ) => {
      blockRef.current   = newBlock;
      arrivalRef.current = Date.now();

      setBlock(newBlock);
      setIntervals(
        newIntervals != null
          ? newIntervals
          : (prev) => appendInterval(prev, intervalSec)
      );
      if (newMiners != null) {
        setRecentMiners(newMiners);
      } else if (newBlock.miner) {
        // In fallback/mock mode, append the new miner to running history
        setRecentMiners((prev) => [...prev.slice(-14), newBlock.miner]);
      }
      setIsNewBlock(true);
      setConfirmationStage("discovery");
      setSecondsAgo(0);

      if (newBlockTimer.current) clearTimeout(newBlockTimer.current);
      newBlockTimer.current = setTimeout(() => setIsNewBlock(false), 3_000);
    },
    []
  );

  // 1-second ticker: keeps secondsAgo and confirmationStage current.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setSecondsAgo(Math.floor((now - blockRef.current.timestamp) / 1000));
      setConfirmationStage(
        computeStage(Math.floor((now - arrivalRef.current) / 1000))
      );
    }, 1_000);
    return () => clearInterval(tick);
  }, []);

  // Data engine: try live mempool.space, fall back to mock on any failure.
  useEffect(() => {
    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let mockStop: (() => void) | null = null;

    async function bootstrap() {
      try {
        // ── Live boot ─────────────────────────────────────────────────────────
        const { block: liveBlock, intervals: liveIntervals, recentMiners: liveMiners } = await fetchLiveBlockData();
        if (stopped) return;

        currentTipRef.current = liveBlock.hash;
        blockRef.current      = liveBlock;
        // For stage timing, treat the block timestamp as arrival time on first load
        arrivalRef.current    = liveBlock.timestamp;

        setBlock(liveBlock);
        setIntervals(liveIntervals);
        setRecentMiners(liveMiners);
        setSecondsAgo(Math.floor((Date.now() - liveBlock.timestamp) / 1000));
        setConfirmationStage(
          computeStage(Math.floor((Date.now() - liveBlock.timestamp) / 1000))
        );
        setDataSource("live");

        // ── Live polling loop ─────────────────────────────────────────────────
        // Checks tip hash every 30 seconds; fetches full block data on change.
        // WEBSOCKET: Replace this interval with a WebSocket subscription.
        pollTimer = setInterval(async () => {
          if (stopped) return;
          try {
            const tipHash = await fetchLiveTipHash();
            if (tipHash !== currentTipRef.current) {
              currentTipRef.current = tipHash;
              const { block: newBlock, intervals: newIntervals, recentMiners: newMiners } = await fetchLiveBlockData();
              if (!stopped) {
                handleNewBlock(newBlock, newBlock.intervalSeconds, newIntervals, newMiners);
              }
            }
          } catch {
            // Transient poll failure — stay in live mode, retry next tick.
            // Only switch to fallback on boot failure (below).
          }
        }, 30_000);

      } catch {
        // ── Fallback (demo) mode ──────────────────────────────────────────────
        if (stopped) return;
        setDataSource("fallback");

        mockStop = startMockBlockEngine((rawBlock, intervalSec) => {
          if (stopped) return;
          const next: BlockData = {
            ...rawBlock,
            height:    blockRef.current.height + 1,
            timestamp: Date.now(),
          };
          handleNewBlock(next, intervalSec);
        });
      }
    }

    bootstrap();
    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (mockStop)  mockStop();
    };
  }, [handleNewBlock]);

  return { block, intervals, isNewBlock, confirmationStage, secondsAgo, dataSource, recentMiners };
}

// ─── FADE VALUE ───────────────────────────────────────────────────────────────
function FadeValue({
  children,
  blockHeight,
  className = "",
}: {
  children: React.ReactNode;
  blockHeight: number;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={blockHeight}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ dataSource }: { dataSource: DataSource }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  const src = SOURCE_CONFIG[dataSource];
  const pulse = dataSource === "live" || dataSource === "connecting";

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-3 w-52 shrink-0">
        <Activity
          className="w-4 h-4 text-primary shrink-0"
          style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
        />
        <span className="font-mono text-[11px] font-bold tracking-widest text-primary uppercase whitespace-nowrap">
          Miner Sentinel Live
        </span>
      </div>

      <div className="text-center flex-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground uppercase">
          Birth of a Bitcoin
        </h1>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
          Watch the network reveal how a block is born.
        </p>
      </div>

      <div className="flex items-center gap-4 w-52 shrink-0 justify-end">
        <div className="font-mono text-lg text-primary tabular-nums w-20 text-right">
          {time.toLocaleTimeString("en-US", {
            hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
          })}
        </div>
        {/* Data source status badge */}
        <Badge
          variant="outline"
          className={`rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-widest shrink-0 transition-colors duration-700
            ${dataSource === "live"
              ? "border-primary/40 text-primary bg-primary/10"
              : dataSource === "fallback"
              ? "border-amber-400/40 text-amber-400/80 bg-amber-400/8"
              : "border-muted-foreground/20 text-muted-foreground/50 bg-transparent"
            }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${src.dotClass}`}
            style={pulse ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}}
          />
          {src.label}
        </Badge>
      </div>
    </header>
  );
}

// ─── ALERT / NEW-BLOCK STRIP ──────────────────────────────────────────────────
function AlertStrip({
  hasAnomaly = false,
  anomalyDescription = "",
  isNewBlock = false,
  newBlockHeight = 0,
  dataSource = "live",
}: {
  hasAnomaly?: boolean;
  anomalyDescription?: string;
  isNewBlock?: boolean;
  newBlockHeight?: number;
  dataSource?: DataSource;
}) {
  const showNew      = isNewBlock && !hasAnomaly;
  const isFallback   = dataSource === "fallback" && !hasAnomaly && !showNew;
  const isConnecting = dataSource === "connecting" && !hasAnomaly && !showNew;

  const stripClass = hasAnomaly
    ? "bg-destructive/20 border-destructive text-destructive-foreground"
    : showNew
    ? "bg-primary/15 border-primary/60 text-primary"
    : isFallback
    ? "bg-amber-400/8 border-amber-400/25 text-amber-400/70"
    : "bg-primary/5 border-primary/20 text-primary/70";

  // Key drives AnimatePresence cross-fade between states
  const activeKey = hasAnomaly ? "anomaly" : showNew ? "newblock" : isFallback ? "fallback" : isConnecting ? "connecting" : "nominal";

  return (
    <div className={`px-8 py-2.5 flex items-center justify-center font-mono text-xs tracking-widest uppercase border-b shrink-0 transition-colors duration-500 ${stripClass}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={activeKey}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-2"
        >
          {hasAnomaly && <><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Anomaly Detected — {anomalyDescription}</>}
          {showNew    && <><Sparkles      className="w-3.5 h-3.5 shrink-0" />New Block Discovered — #{newBlockHeight.toLocaleString()}</>}
          {isFallback && <><WifiOff       className="w-3.5 h-3.5 shrink-0 opacity-60" />Demo Mode Active — Live network data unavailable</>}
          {isConnecting && <><Signal      className="w-3.5 h-3.5 shrink-0 opacity-50" />Connecting to Bitcoin mainnet…</>}
          {activeKey === "nominal" && <><CheckCircle2 className="w-3.5 h-3.5 shrink-0 opacity-50" />All Systems Nominal — No anomalies detected</>}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

// ─── NARRATIVE BAND ───────────────────────────────────────────────────────────
function NarrativeBand() {
  const steps = [
    { label: "Origin",     text: "This is where Bitcoin begins." },
    { label: "Discovery",  text: "A miner discovers a block." },
    { label: "Signal",     text: "The network leaves evidence." },
    { label: "Visibility", text: "Satoshium makes it readable." },
  ];
  return (
    <div className="flex items-stretch justify-center border-b border-border/25 bg-card/15 shrink-0">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex flex-col items-center justify-center px-12 py-3 gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary/45 leading-none">
              {step.label}
            </span>
            <span className="font-mono text-sm text-foreground/60 tracking-wide">
              {step.text}
            </span>
          </div>
          {i < steps.length - 1 && <div className="w-px bg-border/30 my-3 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── BLOCK HASH CARD ──────────────────────────────────────────────────────────
function BlockHashCard({ block, isNewBlock }: { block: BlockData; isNewBlock: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(block.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <motion.div
      className="col-span-3"
      animate={{
        boxShadow: isNewBlock
          ? "0 0 0 1px hsl(var(--primary) / 0.6), 0 0 20px hsl(var(--primary) / 0.12)"
          : "0 0 0 1px transparent",
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="bg-card/40 border-border/50 rounded-none relative overflow-hidden group h-full border-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest">Block Hash</h3>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">Proof of Work</span>
              <Hash className="w-4 h-4 text-primary/40" />
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-4 cursor-pointer group/hash" onClick={handleCopy}>
                <FadeValue blockHeight={block.height}>
                  <div className="font-mono text-xl tracking-wider text-primary/90 bg-[linear-gradient(110deg,#00ffd5,45%,#c0fff5,55%,#00ffd5)] bg-[length:200%_100%] animate-shimmer text-transparent bg-clip-text select-none leading-relaxed">
                    {truncateHash(block.hash)}
                  </div>
                </FadeValue>
                <button
                  className="opacity-0 group-hover/hash:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground shrink-0"
                  aria-label="Copy hash"
                >
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs max-w-xl break-all">
              {block.hash}
            </TooltipContent>
          </Tooltip>
          <p className="font-mono text-[10px] text-muted-foreground/30 mt-1.5 uppercase tracking-widest">
            Hover to reveal full hash · Click to copy
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── BLOCK DISCOVERY CENTERPIECE ─────────────────────────────────────────────
// Bar heights pre-computed once at module load — never recalculate on render.
const BAR_HEIGHTS = Array.from({ length: 9 }, () =>
  parseFloat((1.2 + Math.random() * 1.6).toFixed(3))
);

function BlockDiscoveryPanel({
  block, secondsAgo, isNewBlock, confirmationStage,
}: {
  block: BlockData;
  secondsAgo: number;
  isNewBlock: boolean;
  confirmationStage: ConfirmationStage;
}) {
  return (
    <motion.div
      className="h-full"
      animate={{
        boxShadow: isNewBlock
          ? "0 0 0 1px hsl(var(--primary) / 0.5), 0 0 32px hsl(var(--primary) / 0.15)"
          : "0 0 0 1px hsl(var(--primary) / 0.15)",
      }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <Card className="bg-card/40 rounded-none flex flex-col justify-center items-center relative overflow-hidden h-full border-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-primary/15"
              style={{ width: 64 + i * 72, height: 64 + i * 72 }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: 4.5, repeat: Infinity, delay: i * 1.2, ease: "easeInOut" }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center px-4 flex flex-col items-center w-full">
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary/45 mb-3">
            Block Discovery Signal
          </div>
          <FadeValue blockHeight={block.height}>
            <div className="font-mono text-5xl font-bold text-primary tabular-nums leading-none">
              #{block.height.toLocaleString()}
            </div>
          </FadeValue>
          <div className="font-mono text-sm text-foreground/50 mt-3 mb-4 h-5 w-32 text-center tabular-nums leading-5 overflow-hidden">
            <FadeValue blockHeight={block.height} className="leading-5">
              {formatSecondsAgo(secondsAgo)}
            </FadeValue>
          </div>
          <div className="flex items-end gap-1.5 h-8 justify-center mb-4">
            {BAR_HEIGHTS.map((h, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-sm bg-primary"
                style={{ height: "0.5rem" }}
                animate={{
                  height: [`0.5rem`, `${h}rem`, `0.4rem`, `0.5rem`],
                  opacity: [0.3, 0.85, 0.3],
                }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest">
            {STAGE_ORDER.map((stage, i) => {
              const cfg = STAGE_CONFIG[stage];
              const isActive = confirmationStage === stage;
              const isPast = STAGE_ORDER.indexOf(confirmationStage) > STAGE_ORDER.indexOf(stage);
              return (
                <React.Fragment key={stage}>
                  <span
                    className={`px-2 py-0.5 rounded-sm transition-all duration-700 ${
                      isActive
                        ? `${cfg.active} bg-primary/12 ring-1 ring-primary/30`
                        : isPast
                        ? "text-primary/30"
                        : cfg.inactive
                    }`}
                  >
                    {cfg.label}
                  </span>
                  {i < STAGE_ORDER.length - 1 && (
                    <span className="text-muted-foreground/20 px-0.5">›</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary/30 mt-3">
            Scanning for next block
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────────────────────
function StatCard({
  title, value, subtitle, caption, icon: Icon,
  valueClassName = "", mono = false, flash = false,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  caption?: string;
  icon?: React.ElementType;
  valueClassName?: string;
  mono?: boolean;
  flash?: boolean;
}) {
  return (
    <motion.div
      animate={{
        boxShadow: flash
          ? "0 0 0 1px hsl(var(--primary) / 0.5)"
          : "0 0 0 1px transparent",
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <Card className="bg-card/40 border-border/50 rounded-none relative overflow-hidden group h-full border-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-5 relative z-10 flex flex-col h-full">
          <div className="flex items-start justify-between mb-2 gap-2">
            <h3 className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-widest leading-tight">
              {title}
            </h3>
            {Icon && <Icon className="w-3.5 h-3.5 text-primary/35 shrink-0 mt-px" />}
          </div>
          <div className="mt-auto">
            <div
              className={`text-3xl font-bold tracking-tight leading-none tabular-nums ${mono ? "font-mono" : ""} ${valueClassName}`}
            >
              {value}
            </div>
            {subtitle && (
              <div className="text-xs font-mono text-primary/55 mt-2 flex items-center gap-2">
                {subtitle}
              </div>
            )}
            {caption && (
              <div className="font-mono text-[10px] text-muted-foreground/35 mt-1.5 uppercase tracking-widest leading-tight">
                {caption}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── INTEGRITY SIGNALS ────────────────────────────────────────────────────────
// Status → display configuration
const STATUS_DISPLAY: Record<SignalStatus, { label: string; textClass: string; dotClass: string }> = {
  normal:   { label: "Normal",   textClass: "text-primary/80",           dotClass: "bg-primary"        },
  fast:     { label: "Fast",     textClass: "text-primary",              dotClass: "bg-primary"        },
  slow:     { label: "Slow",     textClass: "text-amber-400/90",         dotClass: "bg-amber-400"      },
  elevated: { label: "Elevated", textClass: "text-amber-400/90",         dotClass: "bg-amber-400"      },
  high:     { label: "High",     textClass: "text-amber-400/90",         dotClass: "bg-amber-400"      },
  low:      { label: "Low",      textClass: "text-muted-foreground/60",  dotClass: "bg-muted-foreground/50" },
  watch:    { label: "Watch",    textClass: "text-amber-400/90",         dotClass: "bg-amber-400"      },
};

function IntegritySignals({
  block,
  intervals,
  recentMiners,
}: {
  block: BlockData;
  intervals: number[];
  recentMiners: string[];
}) {
  const signals = computeSignals(block, intervals, recentMiners);

  const rows: { key: keyof SignalSet; label: string; icon: React.ElementType }[] = [
    { key: "blockTiming",        label: "Block Timing",       icon: Clock    },
    { key: "feeLevel",           label: "Fee Level",          icon: Zap      },
    { key: "txLoad",             label: "Tx Load",            icon: Database },
    { key: "minerConcentration", label: "Pool Concentration", icon: Cpu      },
    { key: "mempoolPressure",    label: "Mempool",            icon: Layers   },
  ];

  return (
    <Card className="bg-card/40 border-border/50 rounded-none flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/40 flex items-center gap-2 shrink-0">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <h2 className="font-mono text-xs tracking-widest uppercase text-foreground">Integrity Signals</h2>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-border/20 overflow-hidden">
        {rows.map(({ key, label, icon: Icon }) => {
          const { status, description } = signals[key];
          const disp = STATUS_DISPLAY[status];
          const pulse = status !== "normal" && status !== "low";
          return (
            <div key={key} className="flex flex-col justify-center px-5 py-3 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="font-mono text-xs text-foreground/65 uppercase tracking-wider truncate">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`font-mono text-[10px] tracking-widest uppercase transition-colors duration-700 ${disp.textClass}`}>
                    {disp.label}
                  </span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-700 ${disp.dotClass}`}
                    style={pulse ? { animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" } : {}}
                  />
                </div>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/40 mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── SIGNAL INSIGHT ───────────────────────────────────────────────────────────
function SignalInsight() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % SIGNAL_INSIGHTS.length);
        setVisible(true);
      }, 400);
    }, 8_000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="border border-border/25 bg-card/15 rounded-none px-6 py-3 flex items-center gap-5 shrink-0 h-11 overflow-hidden">
      <span className="font-mono text-[10px] uppercase tracking-widest text-primary/45 whitespace-nowrap shrink-0">
        Signal Insight
      </span>
      <div className="w-px h-4 bg-border/35 shrink-0" />
      <div className="flex-1 overflow-hidden relative h-5">
        <AnimatePresence mode="wait">
          {visible && (
            <motion.p
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.35 }}
              className="font-mono text-xs text-foreground/45 leading-5 absolute inset-0 whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {SIGNAL_INSIGHTS[idx]}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline({ intervals }: { intervals: number[] }) {
  const data = intervals.map((val, idx) => ({
    index: idx,
    value: val,
    status: val > 900 ? "red" : val > 660 ? "amber" : "teal",
  }));
  return (
    <Card className="bg-card/40 border-border/50 rounded-none shrink-0">
      <div className="px-6 py-3 border-b border-border/40 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs tracking-widest uppercase text-foreground">Recent Block Intervals</h2>
          <p className="font-mono text-[10px] text-muted-foreground/35 mt-0.5 uppercase tracking-widest">
            Last {intervals.length} blocks — time between discoveries
          </p>
        </div>
        <div className="flex items-center gap-5 font-mono text-[10px] text-muted-foreground/45 uppercase tracking-widest shrink-0">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary opacity-80 shrink-0" /> Under 11 min</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-yellow-500 opacity-80 shrink-0" /> 11–15 min</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-destructive opacity-80 shrink-0" /> Over 15 min</div>
        </div>
      </div>
      <CardContent className="p-5 h-[148px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <XAxis dataKey="index" hide />
            <YAxis
              tickFormatter={(val) => `${Math.floor(val / 60)}m`}
              axisLine={false}
              tickLine={false}
              tick={{ fontFamily: "monospace", fontSize: 10, fill: "hsl(var(--muted-foreground))", opacity: 0.5 }}
            />
            <ReferenceLine
              y={600}
              stroke="hsl(var(--primary))"
              strokeDasharray="3 3"
              opacity={0.35}
              label={{
                position: "insideTopLeft", value: "10 MIN AVG",
                fill: "hsl(var(--primary))", fontSize: 9, fontFamily: "monospace", opacity: 0.45,
              }}
            />
            <Bar dataKey="value" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.status === "red"   ? "hsl(var(--destructive))" :
                    entry.status === "amber" ? "#eab308" :
                    "hsl(var(--primary))"
                  }
                  opacity={0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const { block, intervals, isNewBlock, confirmationStage, secondsAgo, dataSource, recentMiners } = useBlockEngine();

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground" style={{ overflow: "hidden" }}>
      <Header dataSource={dataSource} />
      <AlertStrip isNewBlock={isNewBlock} newBlockHeight={block.height} dataSource={dataSource} />
      <NarrativeBand />

      <main className="flex-1 p-5 flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">

          {/* Left: stat grid */}
          <div className="col-span-9 grid grid-cols-3 grid-rows-[auto_auto_auto] gap-3">
            <StatCard
              title="Block Height"
              value={
                <FadeValue blockHeight={block.height}>
                  {block.height.toLocaleString()}
                </FadeValue>
              }
              caption="Blocks mined since genesis block"
              icon={Layers}
              mono
              flash={isNewBlock}
            />
            <StatCard
              title="Time Since Block Found"
              value={
                <FadeValue blockHeight={block.height} className="tabular-nums">
                  {formatSecondsAgo(secondsAgo)}
                </FadeValue>
              }
              subtitle={
                <>
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                    style={{ animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}
                  />
                  Live counter
                </>
              }
              icon={Clock}
              mono
              valueClassName="text-2xl"
              flash={isNewBlock}
            />
            <StatCard
              title="Block Interval"
              value={
                <FadeValue blockHeight={block.height}>
                  {formatInterval(block.intervalSeconds)}
                </FadeValue>
              }
              subtitle="Time since previous block"
              caption="Network target: ~10 minutes"
              icon={Activity}
              mono
            />

            <BlockHashCard block={block} isNewBlock={isNewBlock} />

            <StatCard
              title="Transactions Confirmed"
              value={
                <FadeValue blockHeight={block.height}>
                  {block.txCount.toLocaleString()}
                </FadeValue>
              }
              subtitle="transactions in this block"
              caption="Selected by the miner from the mempool"
              icon={Database}
              mono
              flash={isNewBlock}
            />
            <StatCard
              title="Total Fees Collected"
              value={
                <FadeValue blockHeight={block.height}>
                  {block.totalFeesBTC > 0 ? `${block.totalFeesBTC.toFixed(4)} BTC` : "—"}
                </FadeValue>
              }
              caption="Paid by senders, earned by miner"
              icon={Zap}
              mono
              flash={isNewBlock}
            />

            {/* Miner / Pool — "identity confirmed" badge only when data source confirms it */}
            <StatCard
              title="Miner / Pool"
              value={
                <FadeValue blockHeight={block.height}>
                  {block.miner}
                </FadeValue>
              }
              subtitle={
                block.minerVerified
                  ? (
                    <Badge
                      variant="outline"
                      className="border-primary/40 text-primary bg-primary/10 rounded-none px-1.5 py-0 h-5 text-[9px] uppercase font-mono tracking-widest"
                    >
                      Identity confirmed
                    </Badge>
                  )
                  : (
                    <span className="text-muted-foreground/40 text-[10px] uppercase tracking-widest font-mono">
                      Not resolved
                    </span>
                  )
              }
              caption={`Difficulty ${block.difficulty} · Hashrate ${block.hashrate}`}
              icon={Cpu}
              valueClassName="text-xl"
            />
          </div>

          {/* Right: centerpiece + integrity signals */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0">
            <div className="shrink-0" style={{ height: "42%" }}>
              <BlockDiscoveryPanel
                block={block}
                secondsAgo={secondsAgo}
                isNewBlock={isNewBlock}
                confirmationStage={confirmationStage}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <IntegritySignals block={block} intervals={intervals} recentMiners={recentMiners} />
            </div>
          </div>
        </div>

        <SignalInsight />
        <Timeline intervals={intervals} />
      </main>

      <footer className="shrink-0 py-3 border-t border-border/25 text-center bg-card/10">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground/40">
          Mining is observable behavior.
        </span>
      </footer>
    </div>
  );
}
