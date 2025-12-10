// CCA 可视化模拟器 - 常量定义

export const MPS_TOTAL = 10_000_000; // 1e7 = 100%

export const CONSTANTS = {
  MPS_TOTAL,
  MIN_FLOOR_PRICE: 0.0001,
  MIN_TICK_SPACING: 0.0001,
  MAX_TOTAL_SUPPLY: 2 ** 100,
  
  DISPLAY: {
    MIN_FLOOR_PRICE: 0.0001,
    DEFAULT_FLOOR_PRICE: 0.001,
    DEFAULT_TICK_SPACING: 0.0001,
    DEFAULT_TOTAL_SUPPLY: 1_000_000,
    DEFAULT_REQUIRED_RAISED: 100,
    DEFAULT_START_BLOCK: 0,
    DEFAULT_END_BLOCK: 10000,
  },
};

export const STATUS_COLORS: Record<string, string> = {
  active: '#3b82f6',
  fully_filled: '#22c55e',
  partially_filled: '#f59e0b',
  outbid: '#ef4444',
  refunded: '#9ca3af',
};

export const STATUS_LABELS: Record<string, string> = {
  active: '活跃中',
  fully_filled: '完全成交',
  partially_filled: '部分成交',
  outbid: '被淘汰',
  refunded: '已退款',
};

export const CHART_COLORS = {
  clearingPrice: '#3b82f6',
  floorPrice: '#ef4444',
  demandAbove: '#22c55e',
  demandAt: '#f59e0b',
  demandBelow: '#9ca3af',
  plannedRelease: '#3b82f6',
  actualRelease: '#22c55e',
  currencyRaised: '#8b5cf6',
};

// 预设释放模板
export const PRESET_TEMPLATES = {
  linear: {
    name: '线性释放',
    steps: Array(10).fill(null).map(() => ({ mps: 1_000_000, blockDelta: 1000 })),
  },
  frontLoaded: {
    name: '前重后轻',
    steps: [
      { mps: 2_000_000, blockDelta: 2500 },
      { mps: 500_000, blockDelta: 10000 },
    ],
  },
  backLoaded: {
    name: '后重前轻',
    steps: [
      { mps: 100_000, blockDelta: 5000 },
      { mps: 1_900_000, blockDelta: 5000 },
    ],
  },
};

// 默认配置
export const DEFAULT_CONFIG = {
  totalSupply: 1_000_000,
  floorPrice: 0.001,
  tickSpacing: 0.0001,
  startBlock: 0,
  endBlock: 10000,
  claimBlock: 10100,
  requiredCurrencyRaised: 100,
  steps: [{ mps: 1_000_000, blockDelta: 10000 }],
};
