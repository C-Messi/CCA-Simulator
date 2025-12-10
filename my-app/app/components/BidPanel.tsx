'use client';

import { useState } from 'react';
import { useCCAStore } from '../lib/store';
import { MPS_TOTAL } from '../lib/constants';

export default function BidPanel() {
  const { config, state, phase, submitBid } = useCCAStore();
  const [owner, setOwner] = useState('User_1');
  const [maxPrice, setMaxPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const isRunning = phase === 'running';
  const mpsRemaining = MPS_TOTAL - state.cumulativeMps;
  const effectiveMultiplier = mpsRemaining > 0 ? MPS_TOTAL / mpsRemaining : 1;

  const handleSubmit = () => {
    if (!isRunning) return;
    setError('');
    try {
      const priceNum = parseFloat(maxPrice);
      const amountNum = parseFloat(amount);
      
      if (isNaN(priceNum) || isNaN(amountNum)) {
        setError('请输入有效的数字');
        return;
      }
      
      submitBid({
        maxPrice: priceNum,
        amount: amountNum,
        owner,
      });
      
      setMaxPrice('');
      setAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    }
  };

  const generateRandomBids = (count: number) => {
    if (!isRunning) return;
    for (let i = 0; i < count; i++) {
      const price = config.floorPrice + Math.random() * (config.floorPrice * 5);
      const roundedPrice = Math.ceil(price / config.tickSpacing) * config.tickSpacing;
      const bidAmount = 1 + Math.random() * 20;
      
      try {
        submitBid({
          maxPrice: roundedPrice,
          amount: bidAmount,
          owner: `User_${Math.floor(Math.random() * 100)}`,
        });
      } catch {
        // 忽略无效竞价
      }
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-semibold text-white">模拟出价</h2>
      
      {!isRunning && (
        <div className="text-center text-gray-500 py-4">
          {phase === 'config' ? '请先完成配置并开始模拟' : '拍卖已结束'}
        </div>
      )}
      
      <div className={`space-y-3 ${!isRunning ? 'opacity-50 pointer-events-none' : ''}`}>
        <div>
          <label className="block text-sm text-gray-400 mb-1">出价者</label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            disabled={!isRunning}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            最高出价 (ETH)
            <span className="text-gray-500 ml-2">当前清算价: {state.clearingPrice.toFixed(6)}</span>
          </label>
          <input
            type="number"
            step={config.tickSpacing}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder={`> ${state.clearingPrice.toFixed(6)}`}
            disabled={!isRunning}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">竞价金额 (ETH)</label>
          <input
            type="number"
            step="0.1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!isRunning}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        
        {amount && parseFloat(amount) > 0 && isRunning && (
          <div className="bg-gray-700 rounded p-2 text-sm">
            <div className="text-gray-400">预估信息</div>
            <div className="text-white">
              有效需求: {(parseFloat(amount) * effectiveMultiplier).toFixed(4)} ETH
            </div>
            <div className="text-gray-400 text-xs">
              时间加权倍数: {effectiveMultiplier.toFixed(4)}x
            </div>
          </div>
        )}
        
        {error && (
          <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">
            {error}
          </div>
        )}
        
        <button
          onClick={handleSubmit}
          disabled={!isRunning}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-sm"
        >
          提交出价
        </button>
      </div>
      
      <div className="border-t border-gray-700 pt-4">
        <div className="text-sm text-gray-400 mb-2">批量生成</div>
        <div className="flex gap-2">
          {[5, 10, 20, 50].map((count) => (
            <button
              key={count}
              onClick={() => generateRandomBids(count)}
              disabled={!isRunning}
              className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:opacity-50 text-white text-sm rounded"
            >
              +{count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
