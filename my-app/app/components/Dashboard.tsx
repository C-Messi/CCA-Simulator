'use client';

import { useCCAStore } from '../lib/store';
import { MPS_TOTAL } from '../lib/constants';

export default function Dashboard() {
  const { config, state } = useCCAStore();

  const priceChange = ((state.clearingPrice - config.floorPrice) / config.floorPrice) * 100;
  const fundraisingProgress = (state.currencyRaised / config.requiredCurrencyRaised) * 100;
  const clearingProgress = (state.totalCleared / config.totalSupply) * 100;
  const releaseProgress = (state.cumulativeMps / MPS_TOTAL) * 100;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-white">拍卖状态</h2>
      
      <div className="grid grid-cols-2 gap-3">
        {/* 清算价格 */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-400">清算价格</div>
          <div className="text-xl font-bold text-blue-400">
            {state.clearingPrice.toFixed(6)} ETH
          </div>
          <div className={`text-xs ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}% vs 底价
          </div>
        </div>
        
        {/* 已募集资金 */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-400">已募集资金</div>
          <div className="text-xl font-bold text-purple-400">
            {state.currencyRaised.toFixed(2)} ETH
          </div>
          <div className="mt-1">
            <div className="h-1.5 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(fundraisingProgress, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {fundraisingProgress.toFixed(1)}% / {config.requiredCurrencyRaised} ETH
            </div>
          </div>
        </div>
        
        {/* 已清算代币 */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-400">已清算代币</div>
          <div className="text-xl font-bold text-green-400">
            {state.totalCleared.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1">
            <div className="h-1.5 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500"
                style={{ width: `${clearingProgress}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {clearingProgress.toFixed(1)}% / {config.totalSupply.toLocaleString()}
            </div>
          </div>
        </div>
        
        {/* 毕业状态 */}
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="text-sm text-gray-400">毕业状态</div>
          <div className={`text-xl font-bold ${state.isGraduated ? 'text-green-400' : 'text-yellow-400'}`}>
            {state.isGraduated ? '✓ 已毕业' : '○ 未毕业'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {state.isGraduated 
              ? '已达到募资目标' 
              : `还需 ${(config.requiredCurrencyRaised - state.currencyRaised).toFixed(2)} ETH`
            }
          </div>
        </div>
      </div>
      
      {/* 详细统计 */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400">总竞价数</div>
          <div className="text-white font-mono">{state.bids.size}</div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400">总需求</div>
          <div className="text-white font-mono">
            {state.sumCurrencyDemandAboveClearing.toFixed(2)} ETH
          </div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400">释放进度</div>
          <div className="text-white font-mono">{releaseProgress.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
}
