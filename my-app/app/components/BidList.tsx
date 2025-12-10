'use client';

import { useState } from 'react';
import { useCCAStore } from '../lib/store';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/constants';
import { Bid } from '../lib/types';

export default function BidList() {
  const { state } = useCCAStore();
  const [filter, setFilter] = useState<string>('all');
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);

  const bids = Array.from(state.bids.values()).sort((a, b) => b.id - a.id);
  
  const filteredBids = filter === 'all' 
    ? bids 
    : bids.filter(b => b.status === filter);

  const totalDemand = bids.reduce((sum, b) => sum + b.amount, 0);
  const avgPrice = bids.length > 0 
    ? bids.reduce((sum, b) => sum + b.maxPrice, 0) / bids.length 
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">竞价列表</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded px-2 py-1"
        >
          <option value="all">全部</option>
          <option value="active">活跃中</option>
          <option value="fully_filled">完全成交</option>
          <option value="partially_filled">部分成交</option>
          <option value="outbid">被淘汰</option>
          <option value="refunded">已退款</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-left">
              <th className="pb-2">ID</th>
              <th className="pb-2">出价者</th>
              <th className="pb-2">最高出价</th>
              <th className="pb-2">金额</th>
              <th className="pb-2">区块</th>
              <th className="pb-2">状态</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {filteredBids.slice(0, 20).map((bid) => (
              <tr 
                key={bid.id} 
                className="border-t border-gray-700 hover:bg-gray-700 cursor-pointer"
                onClick={() => setSelectedBid(bid)}
              >
                <td className="py-2 font-mono">{bid.id}</td>
                <td className="py-2">{bid.owner}</td>
                <td className="py-2 font-mono">{bid.maxPrice.toFixed(6)}</td>
                <td className="py-2 font-mono">{bid.amount.toFixed(2)}</td>
                <td className="py-2 font-mono">{bid.startBlock}</td>
                <td className="py-2">
                  <span 
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: STATUS_COLORS[bid.status] + '30', color: STATUS_COLORS[bid.status] }}
                  >
                    {STATUS_LABELS[bid.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredBids.length === 0 && (
          <div className="text-center text-gray-500 py-4">暂无竞价</div>
        )}
        
        {filteredBids.length > 20 && (
          <div className="text-center text-gray-500 py-2 text-sm">
            显示前 20 条，共 {filteredBids.length} 条
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 pt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="text-gray-400">
          共 <span className="text-white">{bids.length}</span> 条竞价
        </div>
        <div className="text-gray-400">
          总需求: <span className="text-white">{totalDemand.toFixed(2)} ETH</span>
        </div>
        <div className="text-gray-400">
          平均出价: <span className="text-white">{avgPrice.toFixed(6)}</span>
        </div>
      </div>

      {/* 竞价详情弹窗 */}
      {selectedBid && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedBid(null)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">竞价详情 #{selectedBid.id}</h3>
              <button onClick={() => setSelectedBid(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-gray-400">出价者</div>
                <div className="text-white">{selectedBid.owner}</div>
                
                <div className="text-gray-400">最高出价</div>
                <div className="text-white font-mono">{selectedBid.maxPrice.toFixed(6)} ETH</div>
                
                <div className="text-gray-400">竞价金额</div>
                <div className="text-white font-mono">{selectedBid.amount.toFixed(4)} ETH</div>
                
                <div className="text-gray-400">提交区块</div>
                <div className="text-white font-mono">{selectedBid.startBlock}</div>
                
                <div className="text-gray-400">有效需求</div>
                <div className="text-white font-mono">{selectedBid.effectiveAmount.toFixed(4)} ETH</div>
                
                <div className="text-gray-400">状态</div>
                <div>
                  <span 
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: STATUS_COLORS[selectedBid.status] + '30', color: STATUS_COLORS[selectedBid.status] }}
                  >
                    {STATUS_LABELS[selectedBid.status]}
                  </span>
                </div>
              </div>
              
              {state.isEnded && (
                <div className="border-t border-gray-700 pt-3 mt-3">
                  <div className="text-gray-400 mb-2">结算信息</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-gray-400">成交代币</div>
                    <div className="text-white font-mono">{selectedBid.tokensFilled.toFixed(2)}</div>
                    
                    <div className="text-gray-400">花费资金</div>
                    <div className="text-white font-mono">{selectedBid.currencySpent.toFixed(4)} ETH</div>
                    
                    <div className="text-gray-400">退款金额</div>
                    <div className="text-white font-mono">{selectedBid.refund.toFixed(4)} ETH</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
