# CCA 可视化模拟器 - 开发进度

## 当前状态: ✅ 核心功能完成 + 逻辑修复

## Phase 1: 核心功能 (MVP) ✅
- [x] 基础配置面板（参数输入）
- [x] 时间轴控制器（区块推进）
- [x] 清算价格计算逻辑
- [x] 手动出价功能
- [x] 状态仪表盘（核心指标）
- [x] 竞价列表

## Phase 2: 可视化增强 ✅
- [x] 清算价格走势图
- [x] 需求分布柱状图
- [x] 代币释放进度图
- [x] 募资进度环形图
- [x] 释放时间表配置器

## Phase 3: 高级功能 ✅
- [x] 预设场景（5个场景）
- [x] 批量出价生成器
- [x] 竞价详情面板
- [x] Tick 链表可视化
- [x] 数据导入导出

## Phase 4: 优化完善 ✅
- [x] 响应式布局
- [x] 配置与模拟阶段分离
- [x] 使用说明/引导

---

## 最新更新：核心逻辑修复

### 修复的问题
基于 CCA 合约源码修复了以下计算逻辑：

1. **清算价格计算** (`iterateAndFindClearingPrice`)
   - 实现了 tick 跨越迭代逻辑
   - 当需求足够推高价格到下一个 tick 时，减去该 tick 的需求并继续迭代
   - 确保清算价格向上取整到 tick 边界

2. **代币销售计算** (`sellTokensAtClearingPrice`)
   - 基础情况：`currencyFromAbove = sumAbove * deltaMps / MPS_TOTAL`
   - 特殊情况：当清算价格正好在某个 tick 上时，分别计算上方贡献和清算价格处贡献
   - 清算价格处贡献 = min(totalCurrencyForDelta - currencyRaisedAbove, expectedAtTick)

3. **竞价结算计算**
   - 完全成交：`tokensFilled = amount * cumulativeMpsPerPriceDelta / mpsRemaining`
   - 部分成交：按竞价在 tick 中的占比分配 `currencyRaisedAtClearingPrice`

4. **有效需求计算**
   - `effectiveAmount = amount * MPS_TOTAL / mpsRemaining`
   - 早期竞价的有效需求更高（时间加权）

### 核心公式对照
```
// 清算价格
clearingPrice = sumCurrencyDemandAboveClearing / totalSupply
clearingPrice = ceil(clearingPrice / tickSpacing) * tickSpacing

// 有效需求（时间加权）
effectiveAmount = bidAmount × (MPS_TOTAL / mpsRemaining)

// 代币销售
currencyFromAbove = sumAbove * deltaMps / MPS_TOTAL
tokensCleared = currencyFromAbove / clearingPrice

// 完全成交结算
tokensFilled = amount * Δ(cumulativeMpsPerPrice) / mpsRemaining
currencySpent = amount * Δ(cumulativeMps) / mpsRemaining
```

---

## 文件结构

### 核心引擎 (app/lib/)
- `types.ts` - 类型定义
- `constants.ts` - 常量和预设模板
- `engine.ts` - CCA 核心计算逻辑（已修复）
- `store.ts` - Zustand 状态管理

### UI 组件 (app/components/)
- `ConfigurationPanel.tsx` - 统一配置面板
- `TimelineController.tsx` - 时间轴控制器
- `BidPanel.tsx` - 出价面板
- `Dashboard.tsx` - 状态仪表盘
- `BidList.tsx` - 竞价列表
- `Charts.tsx` - 4个图表组件
- `ScenarioLoader.tsx` - 预设场景加载器
- `TickChainVisualization.tsx` - Tick 链表可视化
- `DataExportImport.tsx` - 数据导入导出

---

## 运行方式
```bash
cd visualization/my-app
npm run dev
```

## 访问地址
http://localhost:3000
