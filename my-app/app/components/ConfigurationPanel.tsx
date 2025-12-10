'use client';

import { useState } from 'react';
import { useCCAStore } from '../lib/store';
import { PRESET_TEMPLATES } from '../lib/constants';
import { Plus, Trash2, Wand2, Play, RotateCcw } from 'lucide-react';

export default function ConfigurationPanel() {
  const { 
    phase,
    draftConfig, 
    draftSteps, 
    setDraftConfig, 
    setDraftSteps,
    startSimulation,
    resetToConfig,
    resetAll,
  } = useCCAStore();

  const isConfigPhase = phase === 'config';

  // 计算总百分比和总区块
  const totalPercent = draftSteps.reduce((sum, s) => sum + s.percent, 0);
  const totalBlocks = draftSteps.reduce((sum, s) => sum + s.blockDelta, 0);

  const handleStepChange = (index: number, field: 'percent' | 'blockDelta', value: number) => {
    const newSteps = [...draftSteps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setDraftSteps(newSteps);
  };

  const addStep = () => {
    setDraftSteps([...draftSteps, { percent: 10, blockDelta: 1000 }]);
  };

  const removeStep = (index: number) => {
    if (draftSteps.length > 1) {
      setDraftSteps(draftSteps.filter((_, i) => i !== index));
    }
  };

  const applyTemplate = (templateKey: keyof typeof PRESET_TEMPLATES) => {
    const template = PRESET_TEMPLATES[templateKey];
    const totalMps = template.steps.reduce((sum, s) => sum + s.mps * s.blockDelta, 0);
    setDraftSteps(template.steps.map(s => ({
      percent: (s.mps * s.blockDelta / totalMps) * 100,
      blockDelta: s.blockDelta,
    })));
  };

  const normalizeToHundred = () => {
    if (totalPercent === 0) return;
    const factor = 100 / totalPercent;
    setDraftSteps(draftSteps.map(s => ({
      ...s,
      percent: Math.round(s.percent * factor * 100) / 100,
    })));
  };

  const distributeEvenly = () => {
    const evenPercent = 100 / draftSteps.length;
    setDraftSteps(draftSteps.map(s => ({
      ...s,
      percent: Math.round(evenPercent * 100) / 100,
    })));
  };

  // 计算释放曲线数据点
  const curvePoints: { block: number; percent: number }[] = [];
  let cumulative = 0;
  let currentBlock = 0;
  
  for (const step of draftSteps) {
    const normalizedPercent = totalPercent > 0 ? (step.percent / totalPercent) * 100 : 0;
    curvePoints.push({ block: currentBlock, percent: cumulative });
    cumulative += normalizedPercent;
    currentBlock += step.blockDelta;
    curvePoints.push({ block: currentBlock, percent: cumulative });
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">拍卖配置</h2>
        {!isConfigPhase && (
          <div className="flex gap-2">
            <button
              onClick={resetToConfig}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded flex items-center gap-1"
            >
              <RotateCcw size={14} />
              修改配置
            </button>
          </div>
        )}
      </div>

      {/* 基础参数 */}
      <div className={!isConfigPhase ? 'opacity-60 pointer-events-none' : ''}>
        <div className="text-sm text-gray-400 mb-2">基础参数</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">代币总供应量</label>
            <input
              type="number"
              value={draftConfig.totalSupply}
              onChange={(e) => setDraftConfig({ totalSupply: Number(e.target.value) })}
              disabled={!isConfigPhase}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">底价 (ETH)</label>
            <input
              type="number"
              step="0.0001"
              value={draftConfig.floorPrice}
              onChange={(e) => setDraftConfig({ floorPrice: Number(e.target.value) })}
              disabled={!isConfigPhase}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">价格精度 (Tick)</label>
            <input
              type="number"
              step="0.0001"
              value={draftConfig.tickSpacing}
              onChange={(e) => setDraftConfig({ tickSpacing: Number(e.target.value) })}
              disabled={!isConfigPhase}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">毕业门槛 (ETH)</label>
            <input
              type="number"
              value={draftConfig.requiredCurrencyRaised}
              onChange={(e) => setDraftConfig({ requiredCurrencyRaised: Number(e.target.value) })}
              disabled={!isConfigPhase}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* 释放时间表 */}
      <div className={!isConfigPhase ? 'opacity-60 pointer-events-none' : ''}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-400">释放时间表</div>
          {isConfigPhase && (
            <div className="flex gap-2">
              <button
                onClick={distributeEvenly}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 rounded"
              >
                平均分配
              </button>
              <button
                onClick={normalizeToHundred}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-xs text-white rounded flex items-center gap-1"
              >
                <Wand2 size={12} />
                归一化
              </button>
            </div>
          )}
        </div>

        {/* 预设模板 */}
        {isConfigPhase && (
          <div className="flex gap-2 flex-wrap mb-3">
            {Object.entries(PRESET_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => applyTemplate(key as keyof typeof PRESET_TEMPLATES)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
              >
                {template.name}
              </button>
            ))}
          </div>
        )}

        {/* 阶段列表 */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {draftSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-2 bg-gray-700 rounded p-2">
              <span className="text-gray-400 text-xs w-6">#{index + 1}</span>
              
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={step.percent}
                  onChange={(e) => handleStepChange(index, 'percent', Number(e.target.value))}
                  disabled={!isConfigPhase}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
                />
              </div>
              
              <input
                type="number"
                step="0.1"
                min="0"
                value={step.percent}
                onChange={(e) => handleStepChange(index, 'percent', Number(e.target.value))}
                disabled={!isConfigPhase}
                className="w-16 bg-gray-600 text-white rounded px-1 py-0.5 text-xs text-center disabled:opacity-50"
              />
              <span className="text-xs text-gray-400">%</span>
              
              <input
                type="number"
                min="1"
                value={step.blockDelta}
                onChange={(e) => handleStepChange(index, 'blockDelta', Math.max(1, Number(e.target.value)))}
                disabled={!isConfigPhase}
                className="w-20 bg-gray-600 text-white rounded px-2 py-0.5 text-xs disabled:opacity-50"
              />
              <span className="text-xs text-gray-400">块</span>
              
              {isConfigPhase && (
                <button
                  onClick={() => removeStep(index)}
                  disabled={draftSteps.length <= 1}
                  className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        
        {isConfigPhase && (
          <button
            onClick={addStep}
            className="w-full mt-2 py-1.5 border border-dashed border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white rounded flex items-center justify-center gap-1 text-xs"
          >
            <Plus size={14} />
            添加阶段
          </button>
        )}
      </div>

      {/* 配置摘要 */}
      <div className="bg-gray-700 rounded p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400">释放比例:</span>
            <span className={`ml-2 ${totalPercent === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
              {totalPercent.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">总区块:</span>
            <span className="text-white ml-2">{totalBlocks.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-400">结束区块:</span>
            <span className="text-white ml-2">{(draftConfig.startBlock + totalBlocks).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-400">阶段数:</span>
            <span className="text-white ml-2">{draftSteps.length}</span>
          </div>
        </div>

        {/* 释放曲线预览 */}
        <div className="bg-gray-800 rounded p-2 h-20 relative">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="0" y1="50" x2="100" y2="50" stroke="#4b5563" strokeWidth="0.5" strokeDasharray="2" />
            {totalBlocks > 0 && (
              <>
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={curvePoints.map(p => 
                    `${(p.block / totalBlocks) * 100},${100 - p.percent}`
                  ).join(' ')}
                />
                <polygon
                  fill="rgba(59, 130, 246, 0.2)"
                  points={`0,100 ${curvePoints.map(p => 
                    `${(p.block / totalBlocks) * 100},${100 - p.percent}`
                  ).join(' ')} 100,100`}
                />
              </>
            )}
          </svg>
          <div className="absolute left-1 top-0 text-[10px] text-gray-500">100%</div>
          <div className="absolute left-1 bottom-0 text-[10px] text-gray-500">0%</div>
        </div>
      </div>

      {/* 操作按钮 */}
      {isConfigPhase ? (
        <button
          onClick={startSimulation}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center justify-center gap-2"
        >
          <Play size={18} />
          开始模拟
        </button>
      ) : (
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
