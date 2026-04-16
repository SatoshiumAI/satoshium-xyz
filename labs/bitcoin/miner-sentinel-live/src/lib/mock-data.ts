export const currentBlock = {
  height: 892341,
  hash: "0000000000000000000397a5b3c8d12e4f6789abc1234567890abcdef012345",
  timestamp: Date.now() - 47000, // 47 seconds ago
  intervalSeconds: 583, // 9m 43s
  txCount: 3421,
  totalFeesBTC: 0.2847,
  miner: "Foundry USA Pool",
  difficulty: "108.52T",
  hashrate: "~763 EH/s",
};

export const recentIntervals = [427, 621, 889, 543, 312, 1204, 698, 453, 821, 583, 765, 934, 412, 678, 583];

export const signals = {
  blockTiming: "normal",
  feeLevel: "normal",
  txLoad: "normal",
  minerConcentration: "normal",
  mempoolPressure: "normal",
};

// LIVE DATA: Replace this mock with a call to mempool.space or Blockstream API
// Endpoint: https://mempool.space/api/v1/blocks/tip/height
// Endpoint: https://mempool.space/api/blocks/{height}
