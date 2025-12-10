// Zustand Store - CCA 模拟器状态管理

import { create } from 'zustand';
import { AuctionConfig, SimulationState, BidInput, ChartDataPoint, AuctionStep } from './types';
import { DEFAULT_CONFIG, MPS_TOTAL } from './constants';
import {
  createInitialState,
  submitBid,
  advanceBlock,
  advanceToBlock,
} from './engine';

// 模拟阶段
type SimulationPhase = 'config' | 'running' | 'ended';

interface CCAStore {
  // 配置阶段
  phase: SimulationPhase;
  
  // 草稿配置（编辑中）
  draftConfig: {
    totalSupply: number;
    floorPrice: number;
    tickSpacing: number;
    requiredCurrencyRaised: number;
    startBlock: number;
  };
  draftSteps: Array<{ percent: number; blockDelta: number }>;
  
  // 已确认的配置
  config: AuctionConfig;
  
  // 模拟状态
  state: SimulationState;
  
  // 播放控制
  isPlaying: boolean;
  playSpeed: number;
  
  // 图表数据
  chartData: ChartDataPoint[];
  
  // 配置操作
  setDraftConfig: (config: Partial<CCAStore['draftConfig']>) => void;
  setDraftSteps: (steps: Array<{ percent: number; blockDelta: number }>) => void;
  
  // 开始模拟（确认配置）
  startSimulation: () => void;
  
  // 播放控制
  setIsPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: number) => void;
  
  // 模拟操作
  submitBid: (input: BidInput) => void;
  advanceBlock: () => void;
  advanceToBlock: (block: number) => void;
  
  // 重置
  resetToConfig: () => void;
  resetAll: () => void;
  
  // 场景加载
  loadScenario: (config: AuctionConfig, bids?: Array<BidInput & { block: number }>) => void;
}

// 将草稿步骤转换为 AuctionStep
function convertStepsToAuctionSteps(
  draftSteps: Array<{ percent: number; blockDelta: number }>
): AuctionStep[] {
  const totalPercent = draftSteps.reduce((sum, s) => sum + s.percent, 0);
  if (totalPercent === 0) return [{ mps: 1000, blockDelta: 10000 }];
  
  const steps = draftSteps.map(s => {
    const normalizedPercent = (s.percent / totalPercent) * 100;
    const mps = Math.round((normalizedPercent / 100) * MPS_TOTAL / s.blockDelta);
    return { mps, blockDelta: s.blockDelta };
  });
  
  // 修正舍入误差
  const actualTotal = steps.reduce((sum, s) => sum + s.mps * s.blockDelta, 0);
  if (actualTotal !== MPS_TOTAL && steps.length > 0) {
    const diff = MPS_TOTAL - actualTotal;
    steps[steps.length - 1].mps += Math.round(diff / steps[steps.length - 1].blockDelta);
  }
  
  return steps;
}

export const useCCAStore = create<CCAStore>((set, get) => ({
  phase: 'config',
  
  draftConfig: {
    totalSupply: DEFAULT_CONFIG.totalSupply,
    floorPrice: DEFAULT_CONFIG.floorPrice,
    tickSpacing: DEFAULT_CONFIG.tickSpacing,
    requiredCurrencyRaised: DEFAULT_CONFIG.requiredCurrencyRaised,
    startBlock: DEFAULT_CONFIG.startBlock,
  },
  
  draftSteps: [{ percent: 100, blockDelta: 10000 }],
  
  config: DEFAULT_CONFIG,
  state: createInitialState(DEFAULT_CONFIG),
  isPlaying: false,
  playSpeed: 1,
  chartData: [],
  
  setDraftConfig: (newConfig) => {
    set({ draftConfig: { ...get().draftConfig, ...newConfig } });
  },
  
  setDraftSteps: (steps) => {
    set({ draftSteps: steps });
  },
  
  startSimulation: () => {
    const { draftConfig, draftSteps } = get();
    const steps = convertStepsToAuctionSteps(draftSteps);
    const totalBlocks = draftSteps.reduce((sum, s) => sum + s.blockDelta, 0);
    
    const config: AuctionConfig = {
      ...draftConfig,
      endBlock: draftConfig.startBlock + totalBlocks,
      claimBlock: draftConfig.startBlock + totalBlocks + 100,
      steps,
    };
    
    set({
      config,
      state: createInitialState(config),
      phase: 'running',
      chartData: [],
      isPlaying: false,
    });
  },
  
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  
  submitBid: (input) => {
    const { state, config, phase } = get();
    if (phase !== 'running') return;
    
    try {
      const newState = submitBid(state, config, input);
      set({ state: newState });
    } catch (e) {
      console.error('提交竞价失败:', e);
      throw e;
    }
  },
  
  advanceBlock: () => {
    const { state, config, chartData, phase } = get();
    if (phase !== 'running' || state.isEnded) return;
    
    const newState = advanceBlock(state, config);
    const newDataPoint: ChartDataPoint = {
      block: newState.currentBlock,
      clearingPrice: newState.clearingPrice,
      currencyRaised: newState.currencyRaised,
      totalCleared: newState.totalCleared,
      cumulativeMps: newState.cumulativeMps,
    };
    
    set({
      state: newState,
      chartData: [...chartData, newDataPoint],
      phase: newState.isEnded ? 'ended' : 'running',
    });
  },
  
  advanceToBlock: (targetBlock) => {
    const { state, config, phase } = get();
    if (phase !== 'running') return;
    
    const newState = advanceToBlock(state, config, targetBlock);
    
    const chartData: ChartDataPoint[] = [];
    for (const [block, cp] of newState.checkpoints) {
      chartData.push({
        block,
        clearingPrice: cp.clearingPrice,
        currencyRaised: cp.currencyRaised,
        totalCleared: cp.totalCleared,
        cumulativeMps: cp.cumulativeMps,
      });
    }
    chartData.sort((a, b) => a.block - b.block);
    
    set({ 
      state: newState, 
      chartData,
      phase: newState.isEnded ? 'ended' : 'running',
    });
  },
  
  resetToConfig: () => {
    set({
      phase: 'config',
      state: createInitialState(get().config),
      chartData: [],
      isPlaying: false,
    });
  },
  
  resetAll: () => {
    set({
      phase: 'config',
      draftConfig: {
        totalSupply: DEFAULT_CONFIG.totalSupply,
        floorPrice: DEFAULT_CONFIG.floorPrice,
        tickSpacing: DEFAULT_CONFIG.tickSpacing,
        requiredCurrencyRaised: DEFAULT_CONFIG.requiredCurrencyRaised,
        startBlock: DEFAULT_CONFIG.startBlock,
      },
      draftSteps: [{ percent: 100, blockDelta: 10000 }],
      config: DEFAULT_CONFIG,
      state: createInitialState(DEFAULT_CONFIG),
      chartData: [],
      isPlaying: false,
    });
  },
  
  loadScenario: (config, bids) => {
    // 转换为草稿格式
    const totalMps = config.steps.reduce((sum, s) => sum + s.mps * s.blockDelta, 0);
    const draftSteps = config.steps.map(s => ({
      percent: (s.mps * s.blockDelta / totalMps) * 100,
      blockDelta: s.blockDelta,
    }));
    
    set({
      draftConfig: {
        totalSupply: config.totalSupply,
        floorPrice: config.floorPrice,
        tickSpacing: config.tickSpacing,
        requiredCurrencyRaised: config.requiredCurrencyRaised,
        startBlock: config.startBlock,
      },
      draftSteps,
      config,
      phase: 'running',
    });
    
    // 如果有预设竞价，执行它们
    let state = createInitialState(config);
    const chartData: ChartDataPoint[] = [];
    
    if (bids && bids.length > 0) {
      const sortedBids = [...bids].sort((a, b) => a.block - b.block);
      
      for (const bid of sortedBids) {
        while (state.currentBlock < bid.block) {
          state = advanceBlock(state, config);
          chartData.push({
            block: state.currentBlock,
            clearingPrice: state.clearingPrice,
            currencyRaised: state.currencyRaised,
            totalCleared: state.totalCleared,
            cumulativeMps: state.cumulativeMps,
          });
        }
        try {
          state = submitBid(state, config, {
            maxPrice: bid.maxPrice,
            amount: bid.amount,
            owner: bid.owner,
          });
        } catch (e) {
          console.warn('加载场景时竞价失败:', e);
        }
      }
    }
    
    set({ state, chartData, isPlaying: false });
  },
}));
