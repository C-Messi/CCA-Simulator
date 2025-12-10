'use client';

import { useEffect, useRef, useState } from 'react';
import { useCCAStore } from '../lib/store';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { MPS_TOTAL } from '../lib/constants';

export default function TimelineController() {
  const { 
    phase,
    config, 
    state, 
    isPlaying, 
    playSpeed,
    setIsPlaying, 
    setPlaySpeed,
    advanceBlock,
    advanceToBlock,
    resetToConfig,
  } = useCCAStore();
  
  const [jumpBlock, setJumpBlock] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isConfigPhase = phase === 'config';
  const isRunning = phase === 'running';
  const isEnded = phase === 'ended';

  useEffect(() => {
    if (isPlaying && isRunning && !state.isEnded) {
      intervalRef.current = setInterval(() => {
        advanceBlock();
      }, 1000 / playSpeed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, playSpeed, state.isEnded, isRunning, advanceBlock]);

  useEffect(() => {
    if (state.isEnded) setIsPlaying(false);
  }, [state.isEnded, setIsPlaying]);

  const progress = config.endBlock > config.startBlock 
    ? ((state.currentBlock - config.startBlock) / (config.endBlock - config.startBlock)) * 100 
    : 0;
  const mpsProgress = (state.cumulativeMps / MPS_TOTAL) * 100;

  const handleJump = () => {
    const block = parseInt(jumpBlock);
    if (!isNaN(block) && block >= config.startBlock && block <= config.endBlock) {
      advanceToBlock(block);
    }
    setJumpBlock('');
  };

  // 配置阶段显示提示
  if (isConfigPhase) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-center gap-3 text-gray-400 py-4">
          <Settings className="animate-pulse" size={24} />
          <span className="text-lg">请先完成拍卖配置，然后点击"开始模拟"</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">时间轴控制</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded text-xs ${
            isEnded ? 'bg-red-600' : 'bg-green-600'
          }`}>
            {isEnded ? '已结束' : '进行中'}
          </span>
          <span className="text-gray-400">区块:</span>
          <span className="text-white font-mono">{state.currentBlock}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400 font-mono">{config.endBlock}</span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={resetToConfig}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
          title="回到配置"
        >
          <SkipBack size={18} />
        </button>
        <button
          onClick={() => state.currentBlock > config.startBlock && advanceToBlock(Math.max(config.startBlock, state.currentBlock - 100))}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
          title="后退100区块"
          disabled={state.currentBlock <= config.startBlock}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`p-3 rounded text-white ${
            isPlaying ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'
          } disabled:opacity-50`}
          title={isPlaying ? '暂停' : '播放'}
          disabled={isEnded}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          onClick={() => advanceToBlock(Math.min(config.endBlock, state.currentBlock + 100))}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
          title="前进100区块"
          disabled={isEnded}
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => advanceToBlock(config.endBlock)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white disabled:opacity-50"
          title="快进到结束"
          disabled={isEnded}
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* 进度条 */}
      <div className="space-y-1">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-100 ${isEnded ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{config.startBlock}</span>
          <span>{config.endBlock}</span>
        </div>
      </div>

      {/* 播放速度和跳转 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">速度:</span>
          {[1, 10, 100, 1000].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={`px-2 py-1 text-xs rounded ${
                playSpeed === speed 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm text-gray-400">跳转:</span>
          <input
            type="number"
            value={jumpBlock}
            onChange={(e) => setJumpBlock(e.target.value)}
            placeholder="区块号"
            className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm max-w-24"
          />
          <button
            onClick={handleJump}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded"
          >
            跳转
          </button>
        </div>
      </div>

      {/* 状态信息 */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">释放进度</div>
          <div className="text-white font-mono">{mpsProgress.toFixed(2)}%</div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">毕业状态</div>
          <div className={`font-semibold ${state.isGraduated ? 'text-green-400' : 'text-yellow-400'}`}>
            {state.isGraduated ? '已毕业' : '未毕业'}
          </div>
        </div>
        <div className="bg-gray-700 rounded p-2 text-center">
          <div className="text-gray-400 text-xs">竞价数</div>
          <div className="text-white font-mono">{state.bids.size}</div>
        </div>
      </div>
    </div>
  );
}
