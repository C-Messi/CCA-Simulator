'use client';

import { useCCAStore } from '../lib/store';
import { MAX_TICK_PTR } from '../lib/types';

export default function TickChainVisualization() {
  const { state, config } = useCCAStore();

  // 按价格排序的 tick 列表（排除底价哨兵节点如果没有需求）
  const sortedTicks = Array.from(state.ticks.values())
    .filter(tick => tick.price !== config.floorPrice || tick.currencyDemand > 0 || tick.bidIds.length > 0)
    .sort((a, b) => a.price - b.price);

  // 构建链表顺序（通过 next 指针，从底价开始）
  const buildLinkedListOrder = () => {
    const order: number[] = [];
    // 从底价（哨兵节点）开始遍历
    let currentPrice: number = config.floorPrice;
    const visited = new Set<number>();
    
    while (currentPrice !== MAX_TICK_PTR && !visited.has(currentPrice)) {
      order.push(currentPrice);
      visited.add(currentPrice);
      const tick = state.ticks.get(currentPrice);
      if (!tick) break;
      currentPrice = tick.next;
    }
    return order;
  };

  const linkedListOrder = buildLinkedListOrder();
  
  // 过滤掉底价哨兵（如果没有需求）用于显示
  const displayOrder = linkedListOrder.filter(price => {
    if (price === config.floorPrice) {
      const tick = state.ticks.get(price);
      return tick && (tick.currencyDemand > 0 || tick.bidIds.length > 0);
    }
    return true;
  });

  // 检查是否只有底价哨兵节点（没有实际竞价）
  const hasActualBids = displayOrder.length > 0;
  
  if (!hasActualBids) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Tick 链表</h3>
        <div className="text-center text-gray-500 py-8">
          <p>暂无 Tick 数据，请先提交竞价</p>
          <p className="text-xs mt-2">底价哨兵节点: {config.floorPrice} → MAX_TICK_PTR</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-3">Tick 链表 (价格刻度)</h3>
      
      {/* 图例 */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div>
          <span className="text-gray-400">清算价格上方</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500"></div>
          <span className="text-gray-400">清算价格处</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-500"></div>
          <span className="text-gray-400">已淘汰</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-cyan-500"></div>
          <span className="text-gray-400">下一活跃 Tick</span>
        </div>
      </div>

      {/* 链表可视化 - 按链表顺序显示 */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center gap-1 min-w-max">
          {/* 底价标记 */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-red-400 mb-1">底价</div>
            <div className="w-14 h-14 rounded border-2 border-red-500 border-dashed flex items-center justify-center">
              <span className="text-xs text-red-400">{config.floorPrice.toFixed(4)}</span>
            </div>
          </div>

          {displayOrder.map((tickPrice, index) => {
            const tick = state.ticks.get(tickPrice);
            if (!tick) return null;
            
            const isAboveClearing = tick.price > state.clearingPrice;
            const isAtClearing = Math.abs(tick.price - state.clearingPrice) < 1e-10;
            const isNextActiveTick = state.nextActiveTickPrice !== MAX_TICK_PTR && 
              Math.abs(tick.price - state.nextActiveTickPrice) < 1e-10;
            const isFloorPrice = tick.price === config.floorPrice;
            
            let bgColor = 'bg-gray-600';
            let borderColor = 'border-gray-500';
            
            if (isFloorPrice) {
              bgColor = 'bg-red-500/10';
              borderColor = 'border-red-500';
            } else if (isAtClearing) {
              bgColor = 'bg-yellow-500/20';
              borderColor = 'border-yellow-500';
            } else if (isAboveClearing) {
              bgColor = 'bg-green-500/20';
              borderColor = 'border-green-500';
            }
            
            // 如果是下一个活跃 tick，添加特殊边框
            if (isNextActiveTick) {
              borderColor = 'border-cyan-500';
            }

            // 显示 next 指针指向
            const nextTickPrice = tick.next;
            const isNextMax = nextTickPrice === MAX_TICK_PTR;

            return (
              <div key={tick.price} className="flex items-center">
                {/* 连接箭头 - 显示链表 next 指针 */}
                {index > 0 && (
                  <div className="flex flex-col items-center text-gray-500">
                    <div className="flex items-center">
                      <div className="w-6 h-0.5 bg-gray-600"></div>
                      <div className="text-xs text-blue-400">→</div>
                    </div>
                    <div className="text-xs text-gray-600">next</div>
                  </div>
                )}
                
                {/* Tick 节点 */}
                <div className="flex flex-col items-center">
                  {/* 标签行 */}
                  <div className="h-5 flex items-center gap-1">
                    {isFloorPrice && (
                      <span className="text-xs text-red-400">底价</span>
                    )}
                    {isAtClearing && !isFloorPrice && (
                      <span className="text-xs text-yellow-400">清算价格</span>
                    )}
                    {isNextActiveTick && !isAtClearing && (
                      <span className="text-xs text-cyan-400">下一活跃</span>
                    )}
                  </div>
                  
                  <div 
                    className={`w-24 rounded border-2 ${bgColor} ${borderColor} p-2 text-center ${isNextActiveTick ? 'ring-2 ring-cyan-500/50' : ''}`}
                  >
                    <div className="text-xs text-white font-mono font-bold">
                      {tick.price.toFixed(4)}
                    </div>
                    <div className="text-xs text-gray-300 mt-1">
                      {tick.currencyDemand.toFixed(2)} ETH
                    </div>
                    <div className="text-xs text-gray-400">
                      ({tick.bidIds.length}个竞价)
                    </div>
                    {/* 显示 next 指针值 */}
                    <div className="text-xs text-blue-400 mt-1 border-t border-gray-600 pt-1">
                      next: {isNextMax ? 'MAX' : nextTickPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* MAX_TICK_PTR 哨兵标记 */}
          <div className="flex items-center">
            <div className="flex flex-col items-center text-gray-500">
              <div className="flex items-center">
                <div className="w-6 h-0.5 bg-gray-600"></div>
                <div className="text-xs text-blue-400">→</div>
              </div>
              <div className="text-xs text-gray-600">next</div>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-5"></div>
              <div className="w-16 h-14 rounded border-2 border-purple-500 border-dashed flex flex-col items-center justify-center">
                <span className="text-xs text-purple-400">MAX</span>
                <span className="text-xs text-purple-400/60">哨兵</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-4 grid grid-cols-5 gap-2 text-sm">
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">Tick 数量</div>
          <div className="text-white font-mono">{displayOrder.length}</div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">最低出价</div>
          <div className="text-white font-mono">
            {displayOrder.length > 0 ? displayOrder[0].toFixed(4) : '-'}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">最高出价</div>
          <div className="text-white font-mono">
            {displayOrder.length > 0 ? displayOrder[displayOrder.length - 1].toFixed(4) : '-'}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">清算价格</div>
          <div className="text-yellow-400 font-mono">{state.clearingPrice.toFixed(4)}</div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">下一活跃 Tick</div>
          <div className="text-cyan-400 font-mono">
            {state.nextActiveTickPrice === MAX_TICK_PTR ? 'MAX' : state.nextActiveTickPrice.toFixed(4)}
          </div>
        </div>
      </div>

      {/* 链表说明 */}
      <div className="mt-3 p-2 bg-gray-700/50 rounded text-xs text-gray-400">
        <p>💡 Tick 链表说明：底价作为<span className="text-red-400">哨兵节点</span>，每个 Tick 通过 <code className="text-blue-400">next</code> 指针指向下一个已初始化的 Tick。
        链表末尾指向 <span className="text-purple-400">MAX_TICK_PTR</span> 哨兵。
        清算价格只能跨越链表中已存在的 Tick，不会跳转到未初始化的价格。
        <span className="text-cyan-400">下一活跃 Tick</span> 是清算价格之上的第一个已初始化 Tick。</p>
      </div>
    </div>
  );
}
