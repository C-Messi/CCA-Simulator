'use client';

import { useRef, useState } from 'react';
import { useCCAStore } from '../lib/store';
import { Download, Upload, Copy, Check } from 'lucide-react';

interface ExportData {
  version: string;
  exportTime: string;
  config: ReturnType<typeof useCCAStore.getState>['config'];
  state: {
    currentBlock: number;
    clearingPrice: number;
    currencyRaised: number;
    totalCleared: number;
    cumulativeMps: number;
    isGraduated: boolean;
    isEnded: boolean;
  };
  bids: Array<{
    id: number;
    maxPrice: number;
    amount: number;
    owner: string;
    startBlock: number;
    status: string;
    tokensFilled: number;
    currencySpent: number;
    effectiveAmount: number;
  }>;
  checkpoints: Array<{
    blockNumber: number;
    clearingPrice: number;
    cumulativeMps: number;
    currencyRaised: number;
  }>;
}

export default function DataExportImport() {
  const { config, state, loadScenario, reset } = useCCAStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState('');

  const generateExportData = (): ExportData => {
    const bids = Array.from(state.bids.values()).map(bid => ({
      id: bid.id,
      maxPrice: bid.maxPrice,
      amount: bid.amount,
      owner: bid.owner,
      startBlock: bid.startBlock,
      status: bid.status,
      tokensFilled: bid.tokensFilled,
      currencySpent: bid.currencySpent,
      effectiveAmount: bid.effectiveAmount,
    }));

    const checkpoints = Array.from(state.checkpoints.values()).map(cp => ({
      blockNumber: cp.blockNumber,
      clearingPrice: cp.clearingPrice,
      cumulativeMps: cp.cumulativeMps,
      currencyRaised: cp.currencyRaised,
    }));

    return {
      version: '1.0',
      exportTime: new Date().toISOString(),
      config,
      state: {
        currentBlock: state.currentBlock,
        clearingPrice: state.clearingPrice,
        currencyRaised: state.currencyRaised,
        totalCleared: state.totalCleared,
        cumulativeMps: state.cumulativeMps,
        isGraduated: state.isGraduated,
        isEnded: state.isEnded,
      },
      bids,
      checkpoints,
    };
  };

  const handleExport = () => {
    const data = generateExportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `cca-simulation-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const data = generateExportData();
    const json = JSON.stringify(data, null, 2);
    
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const validateImportData = (data: unknown): data is ExportData => {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    
    if (!d.config || typeof d.config !== 'object') return false;
    if (!d.bids || !Array.isArray(d.bids)) return false;
    
    const cfg = d.config as Record<string, unknown>;
    if (typeof cfg.totalSupply !== 'number') return false;
    if (typeof cfg.floorPrice !== 'number') return false;
    if (!cfg.steps || !Array.isArray(cfg.steps)) return false;
    
    return true;
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const data = JSON.parse(json);
        
        if (!validateImportData(data)) {
          setImportError('无效的数据格式');
          return;
        }

        // 转换竞价数据格式
        const bids = data.bids.map(bid => ({
          block: bid.startBlock,
          maxPrice: bid.maxPrice,
          amount: bid.amount,
          owner: bid.owner,
        }));

        loadScenario(data.config, bids);
        setImportError('');
      } catch (err) {
        setImportError('解析文件失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
    };
    reader.readAsText(file);
    
    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-white">数据导入/导出</h3>
      
      {/* 导出按钮 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400">导出当前模拟数据</div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            <Download size={16} />
            下载 JSON
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      {/* 导入按钮 */}
      <div className="space-y-2">
        <div className="text-sm text-gray-400">导入模拟数据</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
        >
          <Upload size={16} />
          选择 JSON 文件
        </button>
        
        {importError && (
          <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">
            {importError}
          </div>
        )}
      </div>

      {/* 当前数据统计 */}
      <div className="border-t border-gray-700 pt-4">
        <div className="text-sm text-gray-400 mb-2">当前数据统计</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-700 rounded p-2">
            <span className="text-gray-400">竞价数:</span>
            <span className="text-white ml-2">{state.bids.size}</span>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <span className="text-gray-400">检查点:</span>
            <span className="text-white ml-2">{state.checkpoints.size}</span>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <span className="text-gray-400">Tick数:</span>
            <span className="text-white ml-2">{state.ticks.size}</span>
          </div>
          <div className="bg-gray-700 rounded p-2">
            <span className="text-gray-400">当前区块:</span>
            <span className="text-white ml-2">{state.currentBlock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
