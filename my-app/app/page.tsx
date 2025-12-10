'use client';

import { useState } from 'react';
import { useCCAStore } from './lib/store';
import ConfigurationPanel from './components/ConfigurationPanel';
import TimelineController from './components/TimelineController';
import BidPanel from './components/BidPanel';
import Dashboard from './components/Dashboard';
import BidList from './components/BidList';
import ScenarioLoader from './components/ScenarioLoader';
import TickChainVisualization from './components/TickChainVisualization';
import DataExportImport from './components/DataExportImport';
import {
  ClearingPriceChart,
  DemandDistributionChart,
  ReleaseProgressChart,
  FundraisingProgressChart,
} from './components/Charts';
import { Settings, BarChart3, List, Database } from 'lucide-react';

type TabType = 'simulation' | 'charts' | 'data';

export default function Home() {
  const { phase } = useCCAStore();
  const [activeTab, setActiveTab] = useState<TabType>('simulation');

  const isConfigPhase = phase === 'config';

  const tabs = [
    { id: 'simulation' as const, label: '模拟', icon: List },
    { id: 'charts' as const, label: '图表', icon: BarChart3, disabled: isConfigPhase },
    { id: 'data' as const, label: '数据', icon: Database },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">CCA 可视化模拟器</h1>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              isConfigPhase 
                ? 'bg-yellow-600/20 text-yellow-400' 
                : phase === 'ended'
                  ? 'bg-red-600/20 text-red-400'
                  : 'bg-green-600/20 text-green-400'
            }`}>
              {isConfigPhase ? '配置中' : phase === 'ended' ? '已结束' : '模拟中'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* 配置阶段 */}
        {isConfigPhase ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ConfigurationPanel />
            </div>
            <div className="space-y-6">
              <ScenarioLoader />
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">快速开始</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>1. 设置基础参数（代币供应量、底价等）</p>
                  <p>2. 配置释放时间表（可使用预设模板）</p>
                  <p>3. 点击"开始模拟"进入模拟阶段</p>
                  <p className="text-gray-500 mt-4">或者选择左侧的预设场景快速体验</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* 时间轴控制器 */}
            <TimelineController />

            {/* 状态仪表盘 */}
            <Dashboard />

            {/* Tab 导航 */}
            <div className="flex gap-2 border-b border-gray-700 pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`flex items-center gap-2 px-4 py-2 rounded-t text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                      : tab.disabled
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                  }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 内容 */}
            {activeTab === 'simulation' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                  <BidPanel />
                  <ConfigurationPanel />
                </div>
                <div className="lg:col-span-2">
                  <BidList />
                </div>
              </div>
            )}

            {activeTab === 'charts' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ClearingPriceChart />
                  <DemandDistributionChart />
                  <ReleaseProgressChart />
                  <FundraisingProgressChart />
                </div>
                <TickChainVisualization />
              </div>
            )}

            {activeTab === 'data' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DataExportImport />
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">使用说明</h3>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div>
                      <div className="text-white font-medium">模拟出价</div>
                      <p className="text-gray-400">在"模拟"标签页手动添加竞价，或使用批量生成功能。</p>
                    </div>
                    <div>
                      <div className="text-white font-medium">推进时间</div>
                      <p className="text-gray-400">使用时间轴控制器推进区块，观察指标变化。</p>
                    </div>
                    <div>
                      <div className="text-white font-medium">查看图表</div>
                      <p className="text-gray-400">在"图表"标签页查看价格走势、需求分布等。</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-3 bg-gray-700 rounded">
                    <div className="text-white font-medium mb-2">核心概念</div>
                    <ul className="text-sm text-gray-400 space-y-1">
                      <li>• <span className="text-blue-400">清算价格</span>: 使总需求=总供应的统一价格</li>
                      <li>• <span className="text-green-400">时间加权</span>: 早期出价有效需求更高</li>
                      <li>• <span className="text-yellow-400">Tick</span>: 价格刻度，出价必须对齐</li>
                      <li>• <span className="text-purple-400">毕业</span>: 募资达到门槛</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 px-6 py-4 mt-12">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          CCA 可视化模拟器 - 纯前端模拟，无需区块链交互
        </div>
      </footer>
    </div>
  );
}
