'use client';

import { useCCAStore } from '../lib/store';
import { CHART_COLORS, MPS_TOTAL } from '../lib/constants';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// 清算价格走势图
export function ClearingPriceChart() {
  const { chartData, config } = useCCAStore();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">清算价格走势</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="block" 
              stroke="#9ca3af" 
              fontSize={10}
              tickFormatter={(v) => v.toString()}
            />
            <YAxis 
              stroke="#9ca3af" 
              fontSize={10}
              tickFormatter={(v) => v.toFixed(4)}
              domain={[config.floorPrice * 0.9, 'auto']}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: number) => [value.toFixed(6) + ' ETH', '清算价格']}
            />
            <ReferenceLine 
              y={config.floorPrice} 
              stroke={CHART_COLORS.floorPrice} 
              strokeDasharray="5 5"
              label={{ value: '底价', fill: CHART_COLORS.floorPrice, fontSize: 10 }}
            />
            <Line 
              type="stepAfter" 
              dataKey="clearingPrice" 
              stroke={CHART_COLORS.clearingPrice} 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 需求分布柱状图
export function DemandDistributionChart() {
  const { state } = useCCAStore();

  const tickData = Array.from(state.ticks.values())
    .sort((a, b) => a.price - b.price)
    .map(tick => ({
      price: tick.price.toFixed(4),
      demand: tick.currencyDemand,
      isAboveClearing: tick.price > state.clearingPrice,
      isAtClearing: tick.price === state.clearingPrice,
    }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">需求分布 (按价格)</h3>
      <div className="h-48">
        {tickData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tickData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="price" stroke="#9ca3af" fontSize={10} />
              <YAxis stroke="#9ca3af" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                formatter={(value: number) => [value.toFixed(4) + ' ETH', '需求']}
              />
              <Bar dataKey="demand">
                {tickData.map((entry, index) => (
                  <Cell 
                    key={index}
                    fill={
                      entry.isAtClearing 
                        ? CHART_COLORS.demandAt 
                        : entry.isAboveClearing 
                          ? CHART_COLORS.demandAbove 
                          : CHART_COLORS.demandBelow
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            暂无竞价数据
          </div>
        )}
      </div>
    </div>
  );
}

// 代币释放进度图
export function ReleaseProgressChart() {
  const { chartData, config } = useCCAStore();

  const releaseData = chartData.map(d => ({
    block: d.block,
    progress: (d.cumulativeMps / MPS_TOTAL) * 100,
  }));

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">代币释放进度</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={releaseData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="block" 
              stroke="#9ca3af" 
              fontSize={10}
            />
            <YAxis 
              stroke="#9ca3af" 
              fontSize={10}
              domain={[0, 100]}
              tickFormatter={(v) => v + '%'}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
              formatter={(value: number) => [value.toFixed(2) + '%', '释放进度']}
            />
            <Line 
              type="monotone" 
              dataKey="progress" 
              stroke={CHART_COLORS.actualRelease} 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 募资进度环形图
export function FundraisingProgressChart() {
  const { state, config } = useCCAStore();

  const progress = Math.min((state.currencyRaised / config.requiredCurrencyRaised) * 100, 100);
  const remaining = 100 - progress;

  const data = [
    { name: '已募集', value: progress, color: CHART_COLORS.currencyRaised },
    { name: '剩余', value: remaining, color: '#374151' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">募资进度</h3>
      <div className="h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-white">{progress.toFixed(1)}%</div>
          <div className="text-xs text-gray-400">{state.currencyRaised.toFixed(2)} ETH</div>
        </div>
      </div>
      <div className="text-center text-sm">
        <span className={state.isGraduated ? 'text-green-400' : 'text-yellow-400'}>
          {state.isGraduated ? '✓ 已毕业' : `距毕业: ${(config.requiredCurrencyRaised - state.currencyRaised).toFixed(2)} ETH`}
        </span>
      </div>
    </div>
  );
}
