// CCA 可视化模拟器 - 类型定义
// 参考 indexer/auction.ts 和 indexer/utils/auction-utils.ts

export interface AuctionStep {
  mps: number;          // 每区块释放的 mps (1e7 = 100%)
  blockDelta: number;   // 持续区块数
}

export interface AuctionConfig {
  totalSupply: number;
  floorPrice: number;
  tickSpacing: number;
  startBlock: number;
  endBlock: number;
  claimBlock: number;
  requiredCurrencyRaised: number;
  steps: AuctionStep[];
}

export type BidStatus = 
  | 'active'
  | 'fully_filled'
  | 'partially_filled'
  | 'outbid'
  | 'refunded';

export interface Bid {
  id: number;
  maxPrice: number;
  maxPriceQ96?: bigint;           // Q96 精度的最大价格
  amount: number;
  amountQ96?: bigint;             // Q96 精度的金额
  owner: string;
  startBlock: number;
  startCumulativeMps: number;
  effectiveAmount: number;
  effectiveAmountQ96?: bigint;    // Q96 精度的有效金额
  status: BidStatus;
  tokensFilled: number;
  currencySpent: number;
  refund: number;
  // 参考 indexer schema
  lastFullyFilledCheckpointBlock?: number;
  outbidCheckpointBlock?: number | null;
}

// MAX_TICK_PTR 哨兵值，表示链表末尾
export const MAX_TICK_PTR = Number.MAX_SAFE_INTEGER;


export interface Tick {
  price: number;
  currencyDemand: number;
  currencyDemandQ96?: bigint;     // Q96 精度的需求量
  bidIds: number[];
  // next 指向下一个已初始化的 tick 价格
  // MAX_TICK_PTR 表示链表末尾（没有更高的 tick）
  next: number;
}

export interface Checkpoint {
  blockNumber: number;
  clearingPrice: number;
  clearingPriceQ96?: bigint;      // Q96 精度的清算价格
  cumulativeMps: number;
  cumulativeMpsPerPrice: number;
  currencyRaisedAtClearingPrice: number;
  // 参考 indexer: currencyRaisedAtClearingPriceQ96_X7
  currencyRaisedAtClearingPriceQ96_X7?: bigint;
  currencyRaised: number;
  totalCleared: number;
}

export interface SimulationState {
  currentBlock: number;
  clearingPrice: number;
  clearingPriceQ96?: bigint;      // Q96 精度的清算价格
  currencyRaised: number;
  totalCleared: number;
  sumCurrencyDemandAboveClearing: number;
  sumCurrencyDemandAboveClearingQ96?: bigint;  // Q96 精度
  cumulativeMps: number;
  bids: Map<number, Bid>;
  ticks: Map<number, Tick>;
  checkpoints: Map<number, Checkpoint>;
  isGraduated: boolean;
  isEnded: boolean;
  nextBidId: number;
  // 下一个活跃 tick 价格（清算价格之上的第一个已初始化 tick）
  // MAX_TICK_PTR 表示没有更高的 tick（链表末尾）
  nextActiveTickPrice: number;
}

export interface BidInput {
  maxPrice: number;
  amount: number;
  owner: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SettlementResult {
  tokensFilled: number;
  currencySpent: number;
  refund: number;
  status: BidStatus;
}

export interface ChartDataPoint {
  block: number;
  clearingPrice: number;
  currencyRaised: number;
  totalCleared: number;
  cumulativeMps: number;
}

export interface DemandDistribution {
  price: number;
  demand: number;
  bidCount: number;
  isAboveClearing: boolean;
  isAtClearing: boolean;
}
