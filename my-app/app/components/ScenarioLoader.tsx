'use client';

import { useCCAStore } from '../lib/store';
import { AuctionConfig, BidInput } from '../lib/types';

interface Scenario {
  name: string;
  description: string;
  config: AuctionConfig;
  bids: Array<BidInput & { block: number }>;
}

const SCENARIOS: Record<string, Scenario> = {
  coldStart: {
    name: '冷启动',
    description: '少量竞价，价格在底价附近',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      claimBlock: 10100,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      { block: 100, maxPrice: 0.0012, amount: 5, owner: 'User_1' },
      { block: 500, maxPrice: 0.0011, amount: 3, owner: 'User_2' },
      { block: 1000, maxPrice: 0.0015, amount: 8, owner: 'User_3' },
    ],
  },
  
  hotAuction: {
    name: '热门拍卖',
    description: '大量竞价，价格快速上涨',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      claimBlock: 10100,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: Array.from({ length: 50 }, (_, i) => ({
      block: Math.floor(Math.random() * 5000),
      maxPrice: Math.ceil((0.001 + Math.random() * 0.009) / 0.0001) * 0.0001,
      amount: 1 + Math.random() * 30,
      owner: `User_${i + 1}`,
    })),
  },
  
  graduationEdge: {
    name: '毕业边缘',
    description: '募资接近毕业门槛',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      claimBlock: 10100,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      { block: 100, maxPrice: 0.002, amount: 30, owner: 'User_1' },
      { block: 500, maxPrice: 0.0025, amount: 25, owner: 'User_2' },
      { block: 1000, maxPrice: 0.003, amount: 20, owner: 'User_3' },
      { block: 2000, maxPrice: 0.0022, amount: 23, owner: 'User_4' },
    ],
  },
  
  partialFill: {
    name: '部分成交',
    description: '多个竞价在清算价格处部分成交',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      claimBlock: 10100,
      requiredCurrencyRaised: 50,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      { block: 100, maxPrice: 0.002, amount: 20, owner: 'User_1' },
      { block: 200, maxPrice: 0.002, amount: 15, owner: 'User_2' },
      { block: 300, maxPrice: 0.002, amount: 25, owner: 'User_3' },
      { block: 400, maxPrice: 0.002, amount: 10, owner: 'User_4' },
    ],
  },
  
  timeWeighting: {
    name: '时间加权',
    description: '相同金额在不同时间提交的效果对比',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      claimBlock: 10100,
      requiredCurrencyRaised: 50,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      { block: 100, maxPrice: 0.003, amount: 10, owner: 'Early_User' },
      { block: 5000, maxPrice: 0.003, amount: 10, owner: 'Mid_User' },
      { block: 9000, maxPrice: 0.003, amount: 10, owner: 'Late_User' },
    ],
  },
};

export default function ScenarioLoader() {
  const { loadScenario, resetAll, phase } = useCCAStore();

  const handleLoad = (key: string) => {
    const scenario = SCENARIOS[key];
    if (scenario) {
      loadScenario(scenario.config, scenario.bids);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h2 className="text-lg font-semibold text-white">预设场景</h2>
      <p className="text-sm text-gray-400">选择预设场景快速开始模拟</p>
      
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(SCENARIOS).map(([key, scenario]) => (
          <button
            key={key}
            onClick={() => handleLoad(key)}
            className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
          >
            <div className="text-white font-medium text-sm">{scenario.name}</div>
            <div className="text-gray-400 text-xs mt-1">{scenario.description}</div>
          </button>
        ))}
      </div>
      
      {phase !== 'config' && (
        <button
          onClick={resetAll}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm"
        >
          重置所有
        </button>
      )}
    </div>
  );
}
