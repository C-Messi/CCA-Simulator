// CCA 核心计算引擎 - 基于合约逻辑实现
// 参考 indexer/auction.ts 和 indexer/utils/auction-utils.ts 的实现

import { 
  AuctionConfig, 
  AuctionStep, 
  Bid, 
  BidInput, 
  BidStatus, 
  Checkpoint, 
  MAX_TICK_PTR,
  SimulationState, 
  Tick, 
  ValidationResult 
} from './types';
import { MPS_TOTAL } from './constants';

// Q96 定点数常量（参考 indexer/utils/auction-utils.ts）
const FixedPoint96 = {
  RESOLUTION: 96n,
  Q96: 0x1000000000000000000000000n, // 2^96
};

// 将浮点数转换为 Q96 定点数
function toQ96(value: number): bigint {
  return BigInt(Math.round(value * Number(FixedPoint96.Q96)));
}

// 将 Q96 定点数转换为浮点数
function fromQ96(valueQ96: bigint): number {
  return Number(valueQ96) / Number(FixedPoint96.Q96);
}

// 计算 mps/price（Q96 精度）
function getMpsPerPrice(mps: number, priceQ96: bigint): bigint {
  return (BigInt(mps) << (FixedPoint96.RESOLUTION * 2n)) / priceQ96;
}

// 创建初始状态
// 对应合约 TickStorage 构造函数的初始化逻辑
export function createInitialState(config: AuctionConfig): SimulationState {
  const initialCheckpoint: Checkpoint = {
    blockNumber: config.startBlock,
    clearingPrice: config.floorPrice,
    cumulativeMps: 0,
    cumulativeMpsPerPrice: 0,
    currencyRaisedAtClearingPrice: 0,
    currencyRaisedAtClearingPriceQ96_X7: 0n,
    currencyRaised: 0,
    totalCleared: 0,
  };

  const checkpoints = new Map<number, Checkpoint>();
  checkpoints.set(config.startBlock, initialCheckpoint);
  
  // 初始化 tick 链表，设置底价作为哨兵节点
  // 对应合约: _getTick(FLOOR_PRICE).next = MAX_TICK_PTR
  const ticks = new Map<number, Tick>();
  ticks.set(config.floorPrice, {
    price: config.floorPrice,
    currencyDemand: 0,
    currencyDemandQ96: 0n,
    bidIds: [],
    next: MAX_TICK_PTR,
  });
  
  return {
    currentBlock: config.startBlock,
    clearingPrice: config.floorPrice,
    clearingPriceQ96: toQ96(config.floorPrice),
    currencyRaised: 0,
    totalCleared: 0,
    sumCurrencyDemandAboveClearing: 0,
    sumCurrencyDemandAboveClearingQ96: 0n,
    cumulativeMps: 0,
    bids: new Map(),
    ticks,
    checkpoints,
    isGraduated: false,
    isEnded: false,
    nextBidId: 0,
    nextActiveTickPrice: MAX_TICK_PTR,
  };
}

// 获取当前 Step
export function getCurrentStep(
  config: AuctionConfig, 
  block: number
): AuctionStep & { index: number; startBlock: number; endBlock: number } {
  let currentBlock = config.startBlock;
  
  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    const stepEndBlock = currentBlock + step.blockDelta;
    
    if (block < stepEndBlock) {
      return { ...step, index: i, startBlock: currentBlock, endBlock: stepEndBlock };
    }
    currentBlock = stepEndBlock;
  }
  
  const lastStep = config.steps[config.steps.length - 1];
  return {
    ...lastStep,
    index: config.steps.length - 1,
    startBlock: currentBlock - lastStep.blockDelta,
    endBlock: currentBlock,
  };
}


// 计算某区块的累计 MPS
export function calculateCumulativeMps(config: AuctionConfig, block: number): number {
  if (block <= config.startBlock) return 0;
  if (block >= config.endBlock) return MPS_TOTAL;
  
  let cumulativeMps = 0;
  let currentBlock = config.startBlock;
  
  for (const step of config.steps) {
    const stepEndBlock = currentBlock + step.blockDelta;
    
    if (block <= stepEndBlock) {
      const blocksInStep = block - currentBlock;
      cumulativeMps += step.mps * blocksInStep;
      break;
    } else {
      cumulativeMps += step.mps * step.blockDelta;
      currentBlock = stepEndBlock;
    }
  }
  
  return Math.min(cumulativeMps, MPS_TOTAL);
}

// 验证竞价
export function validateBid(
  bid: BidInput, 
  state: SimulationState, 
  config: AuctionConfig
): ValidationResult {
  const errors: string[] = [];
  
  if (bid.maxPrice <= state.clearingPrice) {
    errors.push(`出价必须高于当前清算价格 (${state.clearingPrice.toFixed(6)})`);
  }
  
  const tickMultiple = bid.maxPrice / config.tickSpacing;
  const roundedMultiple = Math.round(tickMultiple);
  if (Math.abs(tickMultiple - roundedMultiple) > 1e-9) {
    errors.push(`出价必须是 ${config.tickSpacing} 的整数倍`);
  }
  
  if (bid.amount <= 0) {
    errors.push('竞价金额必须大于0');
  }
  
  if (state.currentBlock >= config.endBlock) {
    errors.push('拍卖已结束');
  }
  
  if (!bid.owner || bid.owner.trim() === '') {
    errors.push('必须指定出价者');
  }
  
  return { valid: errors.length === 0, errors };
}


// 迭代计算清算价格（处理 tick 跨越）
// 严格对应合约 _iterateOverTicksAndFindClearingPrice 的逻辑
// 
// 关键理解：清算价格 = sumDemand / totalSupply（向上取整）
// tick 链表只用于更新 sumCurrencyDemandAboveClearingQ96，清算价格本身不受 tick 边界约束
function iterateAndFindClearingPrice(
  state: SimulationState,
  config: AuctionConfig
): { clearingPrice: number; clearingPriceQ96: bigint; sumAboveClearing: number; sumAboveClearingQ96: bigint; nextActiveTickPrice: number } {
  const minimumClearingPriceInit = state.clearingPrice || config.floorPrice;
  
  const remainingMps = MPS_TOTAL - state.cumulativeMps;
  if (remainingMps <= 0) {
    return { 
      clearingPrice: minimumClearingPriceInit, 
      clearingPriceQ96: state.clearingPriceQ96 || toQ96(minimumClearingPriceInit),
      sumAboveClearing: state.sumCurrencyDemandAboveClearing,
      sumAboveClearingQ96: state.sumCurrencyDemandAboveClearingQ96 || 0n,
      nextActiveTickPrice: state.nextActiveTickPrice 
    };
  }
  
  let sumCurrencyDemandAboveClearingQ96 = state.sumCurrencyDemandAboveClearingQ96 || toQ96(state.sumCurrencyDemandAboveClearing);
  let nextActiveTickPrice = state.nextActiveTickPrice;
  let minimumClearingPrice = minimumClearingPriceInit;
  
  // 合约中使用的是整数 totalSupply，不是 Q96
  const totalSupply = BigInt(config.totalSupply);
  
  // divUp: (a + b - 1) / b - 对应合约的 divUp
  const divUp = (a: bigint, b: bigint): bigint => {
    if (b === 0n) return 0n;
    return (a + b - 1n) / b;
  };
  
  // 清算价格 = sumDemandQ96 / totalSupply（向上取整）
  // 注意：结果仍然是 Q96 格式，因为 sumDemandQ96 是 Q96
  let clearingPriceQ96 = divUp(sumCurrencyDemandAboveClearingQ96, totalSupply);
  let clearingPrice = fromQ96(clearingPriceQ96);
  
  // 合约逻辑：
  // while (
  //   (nextActiveTickPrice_ != MAX_TICK_PTR && sumCurrencyDemandAboveClearingQ96_ >= TOTAL_SUPPLY * nextActiveTickPrice_)
  //   || clearingPrice == nextActiveTickPrice_
  // )
  // 
  // 注意：TOTAL_SUPPLY * nextActiveTickPrice_ 是整数乘法
  // nextActiveTickPrice_ 在合约中是 Q96 格式的价格
  while (true) {
    if (nextActiveTickPrice === MAX_TICK_PTR) break;
    
    const nextActiveTickPriceQ96 = toQ96(nextActiveTickPrice);
    // 合约: sumCurrencyDemandAboveClearingQ96_ >= TOTAL_SUPPLY * nextActiveTickPrice_
    // 这里 nextActiveTickPrice_ 是 Q96 格式
    const requiredDemandQ96 = totalSupply * nextActiveTickPriceQ96;
    
    const demandExceedsRequired = sumCurrencyDemandAboveClearingQ96 >= requiredDemandQ96;
    const priceEqualsNextTick = Math.abs(clearingPrice - nextActiveTickPrice) < 1e-10;
    
    if (!demandExceedsRequired && !priceEqualsNextTick) break;
    
    const nextActiveTick = state.ticks.get(nextActiveTickPrice);
    if (!nextActiveTick) break;
    
    // 从总需求中减去当前 tick 的需求
    const tickDemandQ96 = nextActiveTick.currencyDemandQ96 || toQ96(nextActiveTick.currencyDemand);
    sumCurrencyDemandAboveClearingQ96 -= tickDemandQ96;
    
    // 更新最小清算价格为当前 tick 价格
    minimumClearingPrice = nextActiveTickPrice;
    
    // 移动到下一个 tick
    nextActiveTickPrice = nextActiveTick.next;
    
    // 重新计算清算价格
    clearingPriceQ96 = divUp(sumCurrencyDemandAboveClearingQ96, totalSupply);
    clearingPrice = fromQ96(clearingPriceQ96);
  }
  
  // 清算价格不能低于最小清算价格（floor price 或最后迭代过的 tick）
  if (clearingPrice < minimumClearingPrice) {
    clearingPrice = minimumClearingPrice;
    clearingPriceQ96 = toQ96(minimumClearingPrice);
  }
  
  return { 
    clearingPrice, 
    clearingPriceQ96,
    sumAboveClearing: fromQ96(sumCurrencyDemandAboveClearingQ96), 
    sumAboveClearingQ96: sumCurrencyDemandAboveClearingQ96,
    nextActiveTickPrice 
  };
}


// 在清算价格处销售代币
// 严格参考合约 _sellTokensAtClearingPrice 的逻辑
// 
// 合约逻辑：
// 1. 基础情况：所有需求都严格高于清算价格，贡献 = sumAboveQ96 * deltaMps
// 2. 特殊情况：清算价格恰好在某个有需求的 tick 上（priceQ96 % TICK_SPACING == 0）
//    此时该 tick 上的竞价者可能被部分成交
function sellTokensAtClearingPrice(
  state: SimulationState,
  config: AuctionConfig,
  deltaMps: number,
  clearingPrice: number,
  clearingPriceQ96: bigint
): { currencyRaised: number; totalCleared: number; currencyRaisedAtClearingPrice: number; currencyRaisedAtClearingPriceQ96_X7: bigint } {
  const sumAboveQ96 = state.sumCurrencyDemandAboveClearingQ96 || toQ96(state.sumCurrencyDemandAboveClearing);
  const deltaMpsU = BigInt(deltaMps);
  
  // 基础情况：需求严格高于清算价格
  // currencyFromAboveQ96X7 = sumAboveQ96 * deltaMps
  let currencyFromAboveQ96X7 = sumAboveQ96 * deltaMpsU;
  let currencyAtClearingPriceQ96X7 = 0n;
  
  // 特殊情况：检查清算价格是否在 tick 边界上
  // 合约: if (priceQ96 % TICK_SPACING == 0)
  // 在我们的实现中，检查是否存在该价格的 tick 且有需求
  const isOnTickBoundary = clearingPrice % config.tickSpacing === 0;
  
  if (isOnTickBoundary) {
    const tick = state.ticks.get(clearingPrice);
    const demandAtPriceQ96 = tick?.currencyDemandQ96 || 0n;
    
    if (demandAtPriceQ96 > 0n) {
      // 严格高于清算价格的贡献
      const currencyRaisedAboveClearingQ96X7 = currencyFromAboveQ96X7;
      
      // (A) 总隐含货币 = TOTAL_SUPPLY * priceQ96 * deltaMps
      const totalCurrencyForDeltaQ96X7 = BigInt(config.totalSupply) * clearingPriceQ96 * deltaMpsU;
      
      // 清算价格处的贡献（通过减法得到）= A - 上方贡献
      const demandAtClearingQ96X7 = totalCurrencyForDeltaQ96X7 - currencyRaisedAboveClearingQ96X7;
      
      // (B) 清算价格处 tick 的预期贡献 = tickDemand * deltaMps
      const expectedAtClearingTickQ96X7 = demandAtPriceQ96 * deltaMpsU;
      
      // 取较小值：如果价格被向上取整，(A) 可能超过 (B)
      currencyAtClearingPriceQ96X7 = demandAtClearingQ96X7 < expectedAtClearingTickQ96X7 
        ? demandAtClearingQ96X7 
        : expectedAtClearingTickQ96X7;
      
      // 实际募集金额 = 上方贡献 + 清算价格处贡献
      currencyFromAboveQ96X7 = currencyAtClearingPriceQ96X7 + currencyRaisedAboveClearingQ96X7;
    }
  }
  
  // 转换为代币数量（向上取整）
  // 合约: tokensClearedQ96X7 = currencyFromAboveQ96X7.fullMulDivUp(FixedPoint96.Q96, priceQ96)
  const tokensClearedQ96X7 = clearingPriceQ96 > 0n 
    ? (currencyFromAboveQ96X7 * FixedPoint96.Q96 + clearingPriceQ96 - 1n) / clearingPriceQ96
    : 0n;
  
  // 转换回浮点数（除以 Q96 和 MPS_TOTAL）
  const currencyFromAbove = Number(currencyFromAboveQ96X7) / Number(FixedPoint96.Q96) / MPS_TOTAL;
  const tokensCleared = Number(tokensClearedQ96X7) / Number(FixedPoint96.Q96) / MPS_TOTAL;
  const currencyAtClearingPrice = Number(currencyAtClearingPriceQ96X7) / Number(FixedPoint96.Q96) / MPS_TOTAL;
  
  // 确保 totalCleared 不超过 totalSupply
  const newTotalCleared = Math.min(state.totalCleared + tokensCleared, config.totalSupply);
  
  return {
    currencyRaised: state.currencyRaised + currencyFromAbove,
    totalCleared: newTotalCleared,
    currencyRaisedAtClearingPrice: currencyAtClearingPrice,
    currencyRaisedAtClearingPriceQ96_X7: currencyAtClearingPriceQ96X7,
  };
}

// 找到前一个 tick
function findPrevTick(ticks: Map<number, Tick>, price: number): number | null {
  let prevPrice: number | null = null;
  for (const [tickPrice] of ticks) {
    if (tickPrice < price) {
      if (prevPrice === null || tickPrice > prevPrice) {
        prevPrice = tickPrice;
      }
    }
  }
  return prevPrice;
}


// 初始化 tick（如果需要）
function initializeTickIfNeeded(
  ticks: Map<number, Tick>, 
  prevPriceHint: number, 
  price: number,
  currentNextActiveTickPrice: number
): { tick: Tick; newNextActiveTickPrice: number } {
  const existingTick = ticks.get(price);
  if (existingTick) {
    return { tick: existingTick, newNextActiveTickPrice: currentNextActiveTickPrice };
  }
  
  if (prevPriceHint >= price) {
    throw new Error('TickPreviousPriceInvalid: prevPrice must be less than price');
  }
  
  const prevTick = ticks.get(prevPriceHint);
  if (!prevTick) {
    throw new Error('TickPreviousPriceInvalid: prevPrice tick not initialized');
  }
  
  let currentPrevPrice = prevPriceHint;
  let nextPrice = prevTick.next;
  
  while (nextPrice < price && nextPrice !== MAX_TICK_PTR) {
    currentPrevPrice = nextPrice;
    const currentTick = ticks.get(nextPrice);
    if (!currentTick) break;
    nextPrice = currentTick.next;
  }
  
  const newTick: Tick = {
    price,
    currencyDemand: 0,
    currencyDemandQ96: 0n,
    bidIds: [],
    next: nextPrice,
  };
  
  const actualPrevTick = ticks.get(currentPrevPrice);
  if (actualPrevTick) {
    actualPrevTick.next = price;
    ticks.set(currentPrevPrice, actualPrevTick);
  }
  
  ticks.set(price, newTick);
  
  let newNextActiveTickPrice = currentNextActiveTickPrice;
  if (nextPrice === currentNextActiveTickPrice) {
    newNextActiveTickPrice = price;
  }
  
  return { tick: newTick, newNextActiveTickPrice };
}


// 提交竞价
// 对应合约 _submitBid 逻辑，参考 indexer BidSubmitted 事件处理
export function submitBid(
  state: SimulationState,
  config: AuctionConfig,
  input: BidInput
): SimulationState {
  const validation = validateBid(input, state, config);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // 计算有效需求（时间加权）
  const mpsRemaining = MPS_TOTAL - state.cumulativeMps;
  const effectiveAmount = mpsRemaining > 0 
    ? input.amount * MPS_TOTAL / mpsRemaining 
    : input.amount;
  const effectiveAmountQ96 = toQ96(effectiveAmount);
  
  const bidId = state.nextBidId;
  const bid: Bid = {
    id: bidId,
    maxPrice: input.maxPrice,
    maxPriceQ96: toQ96(input.maxPrice),
    amount: input.amount,
    amountQ96: toQ96(input.amount),
    owner: input.owner,
    startBlock: state.currentBlock,
    startCumulativeMps: state.cumulativeMps,
    effectiveAmount,
    effectiveAmountQ96,
    status: 'active',
    tokensFilled: 0,
    currencySpent: 0,
    refund: 0,
    lastFullyFilledCheckpointBlock: state.currentBlock,
    outbidCheckpointBlock: null,
  };
  
  const newTicks = new Map(state.ticks);
  for (const [price, tick] of state.ticks) {
    newTicks.set(price, { ...tick });
  }
  
  const { tick, newNextActiveTickPrice } = initializeTickIfNeeded(
    newTicks, 
    config.floorPrice, 
    input.maxPrice,
    state.nextActiveTickPrice
  );
  
  tick.currencyDemand += effectiveAmount;
  tick.currencyDemandQ96 = (tick.currencyDemandQ96 || 0n) + effectiveAmountQ96;
  tick.bidIds = [...tick.bidIds, bidId];
  newTicks.set(input.maxPrice, tick);
  
  const newSumDemand = state.sumCurrencyDemandAboveClearing + effectiveAmount;
  const newSumDemandQ96 = (state.sumCurrencyDemandAboveClearingQ96 || 0n) + effectiveAmountQ96;
  
  const tempState: SimulationState = {
    ...state,
    ticks: newTicks,
    sumCurrencyDemandAboveClearing: newSumDemand,
    sumCurrencyDemandAboveClearingQ96: newSumDemandQ96,
    nextActiveTickPrice: newNextActiveTickPrice,
  };
  
  const { clearingPrice: newClearingPrice, clearingPriceQ96, sumAboveClearing, sumAboveClearingQ96, nextActiveTickPrice } = 
    iterateAndFindClearingPrice(tempState, config);
  
  const newBids = new Map(state.bids);
  newBids.set(bidId, bid);
  
  return {
    ...state,
    bids: newBids,
    ticks: newTicks,
    sumCurrencyDemandAboveClearing: sumAboveClearing,
    sumCurrencyDemandAboveClearingQ96: sumAboveClearingQ96,
    clearingPrice: newClearingPrice,
    clearingPriceQ96,
    nextActiveTickPrice: nextActiveTickPrice,
    nextBidId: bidId + 1,
  };
}


// 推进区块
// 参考 indexer CheckpointUpdated 事件处理
export function advanceBlock(
  state: SimulationState,
  config: AuctionConfig
): SimulationState {
  if (state.currentBlock >= config.endBlock) {
    return { ...state, isEnded: true };
  }
  
  const newBlock = state.currentBlock + 1;
  const newCumulativeMps = calculateCumulativeMps(config, newBlock);
  const deltaMps = newCumulativeMps - state.cumulativeMps;
  
  const { clearingPrice: newClearingPrice, clearingPriceQ96, sumAboveClearing, sumAboveClearingQ96, nextActiveTickPrice } = 
    iterateAndFindClearingPrice(state, config);
  
  const { currencyRaised, totalCleared, currencyRaisedAtClearingPrice, currencyRaisedAtClearingPriceQ96_X7 } = 
    sellTokensAtClearingPrice(
      { ...state, sumCurrencyDemandAboveClearing: sumAboveClearing },
      config,
      deltaMps,
      newClearingPrice,
      clearingPriceQ96
    );
  
  const isGraduated = currencyRaised >= config.requiredCurrencyRaised;
  const isEnded = newBlock >= config.endBlock;
  
  const prevCheckpoint = state.checkpoints.get(state.currentBlock);
  const prevCumulativeMpsPerPrice = prevCheckpoint?.cumulativeMpsPerPrice || 0;
  
  // 计算 cumulativeMpsPerPrice（参考 indexer getMpsPerPrice）
  const mpsPerPriceDelta = deltaMps / newClearingPrice;
  
  const checkpoint: Checkpoint = {
    blockNumber: newBlock,
    clearingPrice: newClearingPrice,
    clearingPriceQ96,
    cumulativeMps: newCumulativeMps,
    cumulativeMpsPerPrice: prevCumulativeMpsPerPrice + mpsPerPriceDelta,
    currencyRaisedAtClearingPrice,
    currencyRaisedAtClearingPriceQ96_X7,
    currencyRaised,
    totalCleared,
  };
  
  const newCheckpoints = new Map(state.checkpoints);
  newCheckpoints.set(newBlock, checkpoint);
  
  // 更新竞价状态（参考 indexer 中的 fully filled 和 partially filled 逻辑）
  const newBids = new Map(state.bids);
  for (const [id, bid] of newBids) {
    const newStatus = calculateBidStatus(bid, newClearingPrice, isEnded, isGraduated);
    
    // 更新 outbidCheckpointBlock（当竞价被淘汰时记录）
    // 参考合约: 只有当 bid.maxPrice < clearingPrice 时才设置 outbidCheckpointBlock
    let outbidCheckpointBlock = bid.outbidCheckpointBlock;
    if (bid.maxPrice < newClearingPrice && outbidCheckpointBlock === null) {
      outbidCheckpointBlock = newBlock;
    }
    
    // 更新 lastFullyFilledCheckpointBlock（当竞价严格高于清算价格时更新）
    // 参考合约: 只有当 bid.maxPrice > clearingPrice 时才更新
    let lastFullyFilledCheckpointBlock = bid.lastFullyFilledCheckpointBlock;
    if (bid.maxPrice > newClearingPrice) {
      lastFullyFilledCheckpointBlock = newBlock;
    }
    
    // 检查是否需要更新
    const needsUpdate = newStatus !== bid.status 
      || outbidCheckpointBlock !== bid.outbidCheckpointBlock
      || lastFullyFilledCheckpointBlock !== bid.lastFullyFilledCheckpointBlock;
    
    if (needsUpdate) {
      newBids.set(id, { 
        ...bid, 
        status: newStatus,
        outbidCheckpointBlock,
        lastFullyFilledCheckpointBlock,
      });
    }
  }
  
  return {
    ...state,
    currentBlock: newBlock,
    cumulativeMps: newCumulativeMps,
    clearingPrice: newClearingPrice,
    clearingPriceQ96,
    sumCurrencyDemandAboveClearing: sumAboveClearing,
    sumCurrencyDemandAboveClearingQ96: sumAboveClearingQ96,
    nextActiveTickPrice: nextActiveTickPrice,
    currencyRaised,
    totalCleared,
    isGraduated,
    isEnded,
    checkpoints: newCheckpoints,
    bids: newBids,
  };
}


// 计算竞价状态
// 参考合约 exitBid 和 exitPartiallyFilledBid 的逻辑
export function calculateBidStatus(
  bid: Bid,
  clearingPrice: number,
  isEnded: boolean,
  isGraduated: boolean
): BidStatus {
  // 拍卖进行中
  if (!isEnded) {
    if (bid.maxPrice > clearingPrice) {
      return 'active';  // 严格高于清算价格 -> 活跃
    } else if (Math.abs(bid.maxPrice - clearingPrice) < 1e-10) {
      return 'partially_filled';  // 等于清算价格 -> 部分成交
    }
    return 'outbid';  // 低于清算价格 -> 被淘汰
  }
  
  // 拍卖结束但未毕业
  if (!isGraduated) {
    return 'refunded';
  }
  
  // 拍卖结束且已毕业
  if (bid.maxPrice > clearingPrice) {
    return 'fully_filled';  // 严格高于清算价格 -> 完全成交
  } else if (Math.abs(bid.maxPrice - clearingPrice) < 1e-10) {
    return 'partially_filled';  // 等于清算价格 -> 部分成交
  }
  return 'outbid';  // 低于清算价格 -> 被淘汰
}

// 结算竞价（完全成交）
// 严格参考 indexer CheckpointUpdated 中 bidsToUpdateFullyFilled 的逻辑
function calculateFullyFilledSettlement(
  bid: Bid,
  state: SimulationState
): { tokensFilled: number; currencySpent: number } {
  const startCheckpoint = state.checkpoints.get(bid.startBlock);
  const endCheckpoint = Array.from(state.checkpoints.values())
    .sort((a, b) => b.blockNumber - a.blockNumber)[0];
  
  if (!startCheckpoint || !endCheckpoint) {
    return { tokensFilled: 0, currencySpent: 0 };
  }
  
  const MPS = BigInt(MPS_TOTAL);
  const mpsRemainingInAuction = MPS - BigInt(startCheckpoint.cumulativeMps);
  const cumulativeMpsDelta = endCheckpoint.cumulativeMps - startCheckpoint.cumulativeMps;
  const cumulativeMpsPerPriceDelta = endCheckpoint.cumulativeMpsPerPrice - startCheckpoint.cumulativeMpsPerPrice;
  
  if (cumulativeMpsPerPriceDelta < 0) {
    console.error(`cumulativeMpsPerPriceDelta < 0: ${cumulativeMpsPerPriceDelta}`);
    return { tokensFilled: 0, currencySpent: 0 };
  }
  
  // 参考 indexer:
  // tokensFilled = (bid.amount * cumulativeMpsPerPriceDelta) / (Q96 * mpsRemainingInAuction)
  // currencySpent = (bid.amount * cumulativeMpsDelta) / mpsRemainingInAuction
  const tokensFilled = (bid.amount * cumulativeMpsPerPriceDelta) / Number(mpsRemainingInAuction);
  let currencySpent = 0;
  if (tokensFilled !== 0) {
    currencySpent = (bid.amount * cumulativeMpsDelta) / Number(mpsRemainingInAuction);
  }
  
  return { tokensFilled, currencySpent };
}


// 结算竞价（部分成交）
// 严格参考 indexer CheckpointUpdated 中 bidsToUpdatePartiallyFilled 的逻辑
function calculatePartiallyFilledSettlement(
  bid: Bid,
  state: SimulationState
): { tokensFilled: number; currencySpent: number } {
  const tick = state.ticks.get(bid.maxPrice);
  if (!tick || tick.currencyDemand === 0) {
    return { tokensFilled: 0, currencySpent: 0 };
  }
  
  const startCheckpoint = state.checkpoints.get(bid.startBlock);
  const endCheckpoint = Array.from(state.checkpoints.values())
    .sort((a, b) => b.blockNumber - a.blockNumber)[0];
  
  if (!startCheckpoint || !endCheckpoint) {
    return { tokensFilled: 0, currencySpent: 0 };
  }
  
  // 找到最后一个清算价格低于当前清算价格的检查点（lastFullyFilledCheckpoint）
  const checkpointsArray = Array.from(state.checkpoints.values())
    .filter(cp => cp.clearingPrice < state.clearingPrice)
    .sort((a, b) => b.blockNumber - a.blockNumber);
  
  const lastFullyFilledCheckpoint = checkpointsArray[0] || startCheckpoint;
  
  const MPS = BigInt(MPS_TOTAL);
  const mpsRemainingInAuction = MPS - BigInt(startCheckpoint.cumulativeMps);
  
  // 先计算 fully filled 部分（从 startCheckpoint 到 lastFullyFilledCheckpoint）
  const cumulativeMpsDelta = lastFullyFilledCheckpoint.cumulativeMps - startCheckpoint.cumulativeMps;
  const cumulativeMpsPerPriceDelta = lastFullyFilledCheckpoint.cumulativeMpsPerPrice - startCheckpoint.cumulativeMpsPerPrice;
  
  let tokensFilled = (bid.amount * cumulativeMpsPerPriceDelta) / Number(mpsRemainingInAuction);
  let currencySpent = 0;
  if (tokensFilled !== 0) {
    currencySpent = (bid.amount * cumulativeMpsDelta) / Number(mpsRemainingInAuction);
  }
  
  // 计算 partially filled 部分
  // 参考 indexer:
  // denominator = tickDemandQ96 * mpsRemainingInAuction
  // partialFilledCurrencySpent = ceil(bid.amount * currencyRaisedAtClearingPriceQ96_X7 / denominator)
  // partialFilledTokensFilled = (bidAmountQ96 * currencyRaisedAtClearingPriceQ96_X7) / denominator / bid.maxPriceQ96
  
  const tickDemandQ96 = tick.currencyDemandQ96 || toQ96(tick.currencyDemand);
  const currencyRaisedAtClearingPriceQ96_X7 = endCheckpoint.currencyRaisedAtClearingPriceQ96_X7 || 0n;
  const denominator = tickDemandQ96 * mpsRemainingInAuction;
  
  if (denominator > 0n) {
    const bidAmountQ96 = bid.amountQ96 || toQ96(bid.amount);
    const maxPriceQ96 = bid.maxPriceQ96 || toQ96(bid.maxPrice);
    
    // ceil division: (a + b - 1) / b
    const partialFilledCurrencySpent = Number((bidAmountQ96 * currencyRaisedAtClearingPriceQ96_X7 + denominator - 1n) / denominator) / Number(FixedPoint96.Q96);
    const partialFilledTokensFilled = Number((bidAmountQ96 * currencyRaisedAtClearingPriceQ96_X7) / denominator / maxPriceQ96);
    
    currencySpent += partialFilledCurrencySpent;
    tokensFilled += partialFilledTokensFilled;
  }
  
  return { tokensFilled, currencySpent };
}


// 结算竞价
export function settleBid(
  bid: Bid,
  state: SimulationState,
  config: AuctionConfig
): Bid {
  if (!state.isGraduated) {
    return {
      ...bid,
      tokensFilled: 0,
      currencySpent: 0,
      refund: bid.amount,
      status: 'refunded',
    };
  }
  
  if (bid.maxPrice > state.clearingPrice) {
    const { tokensFilled, currencySpent } = calculateFullyFilledSettlement(bid, state);
    return {
      ...bid,
      tokensFilled,
      currencySpent,
      refund: bid.amount - currencySpent,
      status: 'fully_filled',
    };
  } else if (Math.abs(bid.maxPrice - state.clearingPrice) < 1e-10) {
    const { tokensFilled, currencySpent } = calculatePartiallyFilledSettlement(bid, state);
    return {
      ...bid,
      tokensFilled,
      currencySpent,
      refund: bid.amount - currencySpent,
      status: 'partially_filled',
    };
  }
  
  return {
    ...bid,
    tokensFilled: 0,
    currencySpent: 0,
    refund: bid.amount,
    status: 'outbid',
  };
}

// 快进到指定区块
export function advanceToBlock(
  state: SimulationState,
  config: AuctionConfig,
  targetBlock: number
): SimulationState {
  let currentState = state;
  const maxBlock = Math.min(targetBlock, config.endBlock);
  
  while (currentState.currentBlock < maxBlock) {
    currentState = advanceBlock(currentState, config);
  }
  
  return currentState;
}

// 重置到开始
export function resetToStart(config: AuctionConfig): SimulationState {
  return createInitialState(config);
}
