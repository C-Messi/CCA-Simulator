# CCA 可视化模拟器 - 前端需求文档

## 1. 项目概述

### 1.1 目标
构建一个**纯前端的 CCA 模拟器**，用于：
- 配置拍卖参数，观察不同配置对拍卖行为的影响
- 模拟用户出价行为，观察清算价格变化
- 可视化展示代币释放、价格发现、需求分布等核心机制
- 帮助理解 CCA 的数学模型和运行逻辑

### 1.2 核心特点
- **无需区块链交互**：完全在前端模拟 CCA 合约逻辑
- **可控时间轴**：可以快进、暂停、回退区块
- **参数可调**：实时调整参数观察效果
- **数据可视化**：图表展示关键指标变化

### 1.3 技术栈建议
- 前端框架：React / Vue / Next.js
- 状态管理：Zustand / Pinia / Redux
- 图表库：ECharts / Recharts / D3.js
- 大数运算：bignumber.js / decimal.js（模拟 Q96 精度）

---

## 2. CCA 核心机制概述（前端需理解）

### 2.1 核心概念
| 概念 | 说明 |
|------|------|
| 清算价格 | 使得 总需求 = 总供应 的统一价格，所有成交者以此价格购买 |
| MPS | Milli-basis Points，1e7 = 100%，用于表示代币释放比例 |
| Tick | 价格刻度，出价必须是 tickSpacing 的整数倍 |
| Checkpoint | 检查点，记录某区块的拍卖状态快照 |
| 毕业 | 募资达到 requiredCurrencyRaised 门槛 |


### 2.2 核心公式

#### 清算价格计算
```
clearingPrice = sumCurrencyDemandAboveClearing / totalSupply

// 清算价格向上取整到 tick 边界
// 清算价格不能低于 floorPrice
// 清算价格只能上升，不能下降
```

#### 有效需求计算（时间加权）
```
// 竞价的有效需求会根据提交时间缩放
effectiveAmount = bidAmount × (MPS_TOTAL / mpsRemaining)

// 示例：
// 拍卖开始时(剩余100%)提交 1 ETH → effectiveAmount = 1 ETH
// 拍卖进行到50%(剩余50%)提交 1 ETH → effectiveAmount = 2 ETH
```

#### 代币分配计算
```
// 完全成交的竞价（maxPrice > clearingPrice）
tokensFilled = bidAmount × Σ(mps/price) / mpsRemaining

// 部分成交的竞价（maxPrice == clearingPrice）
// 按比例分配
```

---

## 3. 数据模型定义

### 3.1 拍卖配置参数
```typescript
interface AuctionConfig {
  // 代币配置
  totalSupply: number;              // 代币总供应量
  
  // 价格配置
  floorPrice: number;               // 底价
  tickSpacing: number;              // 价格精度（tick间距）
  
  // 时间配置
  startBlock: number;               // 开始区块
  endBlock: number;                 // 结束区块
  claimBlock: number;               // 领取区块
  
  // 毕业配置
  requiredCurrencyRaised: number;   // 毕业所需最低募资额
  
  // 释放时间表
  steps: AuctionStep[];             // 代币释放阶段列表
}

interface AuctionStep {
  mps: number;          // 每区块释放的 mps (1e7 = 100%)
  blockDelta: number;   // 持续区块数
}
```

### 3.2 模拟状态
```typescript
interface SimulationState {
  // 当前区块
  currentBlock: number;
  
  // 全局状态
  clearingPrice: number;                    // 当前清算价格
  currencyRaised: number;                   // 已募集资金
  totalCleared: number;                     // 已清算代币数量
  sumCurrencyDemandAboveClearing: number;   // 清算价格上方总需求
  cumulativeMps: number;                    // 累计已释放的 mps
  
  // 数据集合
  bids: Map<number, Bid>;                   // 所有竞价
  ticks: Map<number, Tick>;                 // 所有价格刻度
  checkpoints: Map<number, Checkpoint>;     // 所有检查点
  
  // 状态标记
  isGraduated: boolean;                     // 是否已毕业
  isEnded: boolean;                         // 是否已结束
}
```


### 3.3 竞价数据
```typescript
interface Bid {
  id: number;                   // 竞价ID
  maxPrice: number;             // 最高出价
  amount: number;               // 竞价金额
  owner: string;                // 竞价者标识（模拟用户名）
  
  // 提交时状态
  startBlock: number;           // 提交区块
  startCumulativeMps: number;   // 提交时的累计 mps
  
  // 计算属性
  effectiveAmount: number;      // 有效需求（时间加权后）
  
  // 结算状态
  status: BidStatus;            // 状态
  tokensFilled: number;         // 已成交代币
  currencySpent: number;        // 已花费资金
  refund: number;               // 退款金额
}

type BidStatus = 
  | 'active'           // 活跃中
  | 'fully_filled'     // 完全成交
  | 'partially_filled' // 部分成交
  | 'outbid'           // 被淘汰
  | 'refunded';        // 已退款（未毕业）
```

### 3.4 价格刻度数据
```typescript
interface Tick {
  price: number;                // 价格
  currencyDemand: number;       // 该价格点的总需求
  bidIds: number[];             // 在此价格的竞价ID列表
  next: number | null;          // 下一个已初始化的 tick 价格
}
```

### 3.5 检查点数据
```typescript
interface Checkpoint {
  blockNumber: number;                      // 区块号
  clearingPrice: number;                    // 清算价格
  cumulativeMps: number;                    // 累计 mps
  cumulativeMpsPerPrice: number;            // 累计 mps/price
  currencyRaisedAtClearingPrice: number;    // 在清算价格处募集的资金
  currencyRaised: number;                   // 总募集资金
  totalCleared: number;                     // 已清算代币
}
```

---

## 4. 功能模块

### 4.1 模块一：拍卖配置面板

#### 4.1.1 基础参数配置
| 参数 | 输入类型 | 默认值 | 说明 |
|------|----------|--------|------|
| totalSupply | 数字输入 | 1,000,000 | 代币总供应量 |
| floorPrice | 数字输入 | 0.001 | 底价（ETH） |
| tickSpacing | 数字输入 | 0.0001 | 价格精度 |
| startBlock | 数字输入 | 0 | 开始区块 |
| endBlock | 数字输入 | 10000 | 结束区块 |
| requiredCurrencyRaised | 数字输入 | 100 | 毕业门槛（ETH） |

#### 4.1.2 释放时间表配置器

**UI 需求：**
```
┌─────────────────────────────────────────────────────────────┐
│  释放时间表配置                                              │
├─────────────────────────────────────────────────────────────┤
│  预设模板: [线性释放▼] [前重后轻] [后重前轻] [自定义]         │
├─────────────────────────────────────────────────────────────┤
│  阶段列表:                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ #1  释放比例: [====●=====] 20%   持续区块: [2000]   │ [×]│
│  │ #2  释放比例: [====●=====] 30%   持续区块: [3000]   │ [×]│
│  │ #3  释放比例: [====●=====] 50%   持续区块: [5000]   │ [×]│
│  └─────────────────────────────────────────────────────┘    │
│  [+ 添加阶段]                                                │
├─────────────────────────────────────────────────────────────┤
│  验证状态:                                                   │
│  ✓ 总释放比例: 100% (20% + 30% + 50%)                       │
│  ✓ 总区块数: 10000 (2000 + 3000 + 5000)                     │
├─────────────────────────────────────────────────────────────┤
│  释放曲线预览:                                               │
│       100%|                    ___________                  │
│        80%|              _____/                             │
│        50%|        _____/                                   │
│        20%|  _____/                                         │
│         0%|_/________________________________               │
│            0    2000   5000        10000 (区块)             │
└─────────────────────────────────────────────────────────────┘
```

**预设模板：**
```typescript
const PRESET_TEMPLATES = {
  linear: [
    { mps: 1000000, blockDelta: 1000 },  // 10% per 1000 blocks
    { mps: 1000000, blockDelta: 1000 },
    // ... 重复10次
  ],
  
  frontLoaded: [  // 前重后轻
    { mps: 2000000, blockDelta: 2500 },  // 50% in first 25%
    { mps: 500000, blockDelta: 10000 },  // 50% in remaining 75%
  ],
  
  backLoaded: [   // 后重前轻
    { mps: 100000, blockDelta: 5000 },   // 5% in first 50%
    { mps: 1900000, blockDelta: 5000 },  // 95% in last 50%
  ],
};
```


---

### 4.2 模块二：时间轴控制器

#### 4.2.1 控制面板
```
┌─────────────────────────────────────────────────────────────┐
│  时间轴控制                                                  │
├─────────────────────────────────────────────────────────────┤
│  [|◀] [◀] [▶/⏸] [▶|] [▶▶]     当前区块: 3456 / 10000       │
│                                                             │
│  ├──────────────●────────────────────────────────────────┤  │
│  0            3456                                  10000   │
│  开始                                                结束   │
│                                                             │
│  播放速度: [1x] [10x] [100x] [1000x]                        │
│  跳转到区块: [______] [跳转]                                 │
├─────────────────────────────────────────────────────────────┤
│  拍卖阶段: [■ 进行中]  当前Step: #2 (mps: 1500000)          │
│  剩余区块: 6544       预计剩余时间: ~21.8小时 (按12s/块)     │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 控制功能
| 按钮 | 功能 |
|------|------|
| `|◀` | 回到开始 |
| `◀` | 后退1个区块 |
| `▶/⏸` | 播放/暂停自动推进 |
| `▶|` | 前进1个区块 |
| `▶▶` | 快进到下一个事件（下一个竞价/检查点） |

#### 4.2.3 区块推进逻辑
```typescript
function advanceBlock(state: SimulationState): SimulationState {
  const newBlock = state.currentBlock + 1;
  
  // 1. 计算当前 step 的 mps
  const currentStep = getCurrentStep(state.config, newBlock);
  
  // 2. 更新累计 mps
  const newCumulativeMps = state.cumulativeMps + currentStep.mps;
  
  // 3. 重新计算清算价格
  const newClearingPrice = calculateClearingPrice(state);
  
  // 4. 计算代币销售
  const { currencyRaised, totalCleared } = sellTokensAtClearingPrice(
    state, 
    currentStep.mps, 
    newClearingPrice
  );
  
  // 5. 更新毕业状态
  const isGraduated = currencyRaised >= state.config.requiredCurrencyRaised;
  
  // 6. 创建检查点
  const checkpoint = createCheckpoint(newBlock, ...);
  
  return {
    ...state,
    currentBlock: newBlock,
    cumulativeMps: newCumulativeMps,
    clearingPrice: newClearingPrice,
    currencyRaised,
    totalCleared,
    isGraduated,
  };
}
```

---

### 4.3 模块三：模拟出价面板

#### 4.3.1 手动出价
```
┌─────────────────────────────────────────────────────────────┐
│  模拟出价                                                    │
├─────────────────────────────────────────────────────────────┤
│  出价者: [User_1 ▼]  [+ 新建用户]                           │
│                                                             │
│  最高出价:                                                   │
│  [0.0025    ] ETH                                           │
│  ├────────────────●──────────────────────────────────────┤  │
│  0.001 (底价)                              0.01 (最高)      │
│  ⚠️ 必须高于当前清算价格 (0.0018)                            │
│                                                             │
│  竞价金额:                                                   │
│  [10        ] ETH                                           │
│                                                             │
│  预估信息:                                                   │
│  • 有效需求: 15 ETH (时间加权后)                             │
│  • 预估可获得: ~6,000 代币                                   │
│  • 预估成交比例: 100% (出价高于清算价格)                      │
│                                                             │
│  [提交出价]                                                  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.2 批量出价生成器
```
┌─────────────────────────────────────────────────────────────┐
│  批量出价生成                                                │
├─────────────────────────────────────────────────────────────┤
│  生成模式: [随机分布▼]                                       │
│                                                             │
│  • 出价数量: [50    ]                                       │
│  • 价格范围: [0.001 ] ~ [0.005 ] ETH                        │
│  • 金额范围: [1     ] ~ [20    ] ETH                        │
│  • 分布类型: [正态分布▼] / 均匀分布 / 集中在某价格            │
│                                                             │
│  [生成并添加]  [预览分布]                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.3 出价验证规则
```typescript
function validateBid(bid: BidInput, state: SimulationState): ValidationResult {
  const errors: string[] = [];
  
  // 1. 价格必须高于清算价格
  if (bid.maxPrice <= state.clearingPrice) {
    errors.push(`出价必须高于当前清算价格 (${state.clearingPrice})`);
  }
  
  // 2. 价格必须是 tickSpacing 的整数倍
  if (bid.maxPrice % state.config.tickSpacing !== 0) {
    errors.push(`出价必须是 ${state.config.tickSpacing} 的整数倍`);
  }
  
  // 3. 价格不能超过最大出价
  const maxBidPrice = calculateMaxBidPrice(state.config.totalSupply);
  if (bid.maxPrice > maxBidPrice) {
    errors.push(`出价不能超过 ${maxBidPrice}`);
  }
  
  // 4. 金额必须大于0
  if (bid.amount <= 0) {
    errors.push('竞价金额必须大于0');
  }
  
  // 5. 拍卖必须在进行中
  if (state.currentBlock >= state.config.endBlock) {
    errors.push('拍卖已结束');
  }
  
  return { valid: errors.length === 0, errors };
}
```


---

### 4.4 模块四：状态仪表盘

#### 4.4.1 核心指标卡片
```
┌─────────────────────────────────────────────────────────────┐
│  拍卖状态概览                                                │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  清算价格     │  已募集资金   │  已清算代币   │  毕业状态     │
│  0.00234 ETH │  156.8 ETH   │  670,000     │  ✓ 已毕业     │
│  ↑ +17.5%    │  ████████░░  │  ██████░░░░  │              │
│  (vs 底价)   │  156.8/200   │  67%/100%    │              │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

#### 4.4.2 详细状态面板
```typescript
interface DashboardData {
  // 价格信息
  clearingPrice: number;
  floorPrice: number;
  priceChangePercent: number;        // 相对底价的涨幅
  nextActiveTickPrice: number;       // 下一个有需求的 tick
  
  // 募资信息
  currencyRaised: number;
  requiredCurrencyRaised: number;
  fundraisingProgress: number;       // 百分比
  
  // 代币信息
  totalCleared: number;
  totalSupply: number;
  clearingProgress: number;          // 百分比
  
  // 释放信息
  cumulativeMps: number;
  releaseProgress: number;           // 百分比 (cumulativeMps / 1e7)
  currentStep: number;               // 当前阶段索引
  
  // 需求信息
  totalDemand: number;               // 总需求
  demandAboveClearing: number;       // 清算价格上方需求
  
  // 竞价统计
  totalBids: number;
  activeBids: number;
  averageBidPrice: number;
}
```

---

### 4.5 模块五：可视化图表

#### 4.5.1 图表1：清算价格走势
```
┌─────────────────────────────────────────────────────────────┐
│  清算价格走势                                                │
│                                                             │
│  0.003|                              ___●                   │
│       |                         ____/                       │
│  0.002|                   _____/                            │
│       |              ____/                                  │
│  0.001|_____________/                                       │
│       |─────────────────────────────────────────────────    │
│       0    1000   2000   3000   4000   5000  (区块)         │
│                                                             │
│  ── 清算价格  ─ ─ 底价线  ● 当前位置                         │
└─────────────────────────────────────────────────────────────┘
```

**数据点来源：** 每个 Checkpoint 的 clearingPrice

#### 4.5.2 图表2：代币释放进度
```
┌─────────────────────────────────────────────────────────────┐
│  代币释放进度                                                │
│                                                             │
│  100%|                              ___________●            │
│      |                         ____/                        │
│   50%|                   _____/                             │
│      |              ____/                                   │
│    0%|_____________/                                        │
│      |─────────────────────────────────────────────────     │
│      0    2000   4000   6000   8000   10000 (区块)          │
│                                                             │
│  ── 计划释放  ── 实际释放  │ 阶段分界                        │
└─────────────────────────────────────────────────────────────┘
```

**双线对比：**
- 计划释放曲线：根据 steps 配置计算
- 实际释放曲线：cumulativeMps 的实际值

#### 4.5.3 图表3：需求分布柱状图
```
┌─────────────────────────────────────────────────────────────┐
│  需求分布 (按价格)                                           │
│                                                             │
│  需求|     ▓▓▓                                              │
│  (ETH)     ▓▓▓  ▓▓▓                                        │
│      |     ▓▓▓  ▓▓▓  ▓▓▓                                   │
│      | ▓▓▓ ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓                              │
│      | ▓▓▓ ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓  ▓▓▓                         │
│      |─────────────────────────────────────────────────     │
│       0.001 0.0015 0.002 0.0025 0.003 0.0035 (价格)         │
│                    ↑                                        │
│              清算价格                                        │
│                                                             │
│  ▓ 清算价格上方需求  ░ 清算价格处需求                         │
└─────────────────────────────────────────────────────────────┘
```

#### 4.5.4 图表4：募资进度环形图
```
┌─────────────────────────────────────────────────────────────┐
│  募资进度                                                    │
│                                                             │
│           ╭───────────╮                                     │
│         ╱   156.8 ETH  ╲                                    │
│        │    ████████    │                                   │
│        │    ████████    │   已募集: 156.8 ETH               │
│        │    ░░░░░░░░    │   目标: 200 ETH                   │
│         ╲    78.4%     ╱    距毕业: 43.2 ETH                │
│           ╰───────────╯                                     │
│                                                             │
│  状态: [■ 未毕业] / [✓ 已毕业]                               │
└─────────────────────────────────────────────────────────────┘
```

#### 4.5.5 图表5：竞价时间分布
```
┌─────────────────────────────────────────────────────────────┐
│  竞价时间分布                                                │
│                                                             │
│  数量|                                                      │
│      |  ●                                                   │
│      |  ●  ●                                                │
│      |  ●  ●     ●                                          │
│      |  ●  ●  ●  ●  ●                                       │
│      |  ●  ●  ●  ●  ●  ●  ●                                 │
│      |─────────────────────────────────────────────────     │
│       0    1000   2000   3000   4000   5000  (区块)         │
│                                                             │
│  每个点代表一个竞价，Y轴为该区块的竞价数量                     │
└─────────────────────────────────────────────────────────────┘
```


---

### 4.6 模块六：竞价列表与详情

#### 4.6.1 竞价列表表格
```
┌─────────────────────────────────────────────────────────────────────────┐
│  竞价列表                                    筛选: [全部▼] 搜索: [____] │
├─────┬────────┬──────────┬──────────┬────────┬──────────┬───────────────┤
│ ID  │ 出价者  │ 最高出价  │ 竞价金额  │ 提交区块│ 状态     │ 预估代币      │
├─────┼────────┼──────────┼──────────┼────────┼──────────┼───────────────┤
│ 1   │ User_1 │ 0.0030   │ 15 ETH   │ 500    │ ✓ 完全成交│ 5,000        │
│ 2   │ User_2 │ 0.0025   │ 10 ETH   │ 800    │ ✓ 完全成交│ 4,000        │
│ 3   │ User_3 │ 0.0020   │ 20 ETH   │ 1200   │ ◐ 部分成交│ 6,500 (65%)  │
│ 4   │ User_4 │ 0.0018   │ 8 ETH    │ 1500   │ ✗ 被淘汰  │ 0            │
│ 5   │ User_1 │ 0.0035   │ 5 ETH    │ 2000   │ ○ 活跃中  │ ~1,400       │
├─────┴────────┴──────────┴──────────┴────────┴──────────┴───────────────┤
│  共 5 条竞价  总需求: 58 ETH  平均出价: 0.00256 ETH                      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.6.2 竞价详情弹窗
```
┌─────────────────────────────────────────────────────────────┐
│  竞价详情 #3                                          [×]   │
├─────────────────────────────────────────────────────────────┤
│  基本信息                                                    │
│  ├── 出价者: User_3                                         │
│  ├── 最高出价: 0.0020 ETH                                   │
│  ├── 竞价金额: 20 ETH                                       │
│  └── 提交区块: 1200                                         │
│                                                             │
│  时间加权                                                    │
│  ├── 提交时累计MPS: 1,200,000 (12%)                         │
│  ├── 剩余MPS: 8,800,000 (88%)                               │
│  └── 有效需求: 22.73 ETH (20 × 1e7 / 8.8e6)                 │
│                                                             │
│  成交状态: ◐ 部分成交                                        │
│  ├── 成交代币: 6,500                                        │
│  ├── 花费资金: 13 ETH                                       │
│  ├── 退款金额: 7 ETH                                        │
│  └── 成交比例: 65%                                          │
│                                                             │
│  状态说明:                                                   │
│  该竞价的最高出价等于最终清算价格，因此按比例部分成交。         │
│  成交比例 = 该竞价有效需求 / 清算价格处总需求                  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.6.3 状态计算逻辑
```typescript
function calculateBidStatus(bid: Bid, state: SimulationState): BidStatus {
  // 拍卖未结束时
  if (!state.isEnded) {
    if (bid.maxPrice > state.clearingPrice) {
      return 'active';  // 出价高于清算价格，活跃中
    } else {
      return 'outbid';  // 已被淘汰（清算价格超过了出价）
    }
  }
  
  // 拍卖结束后
  if (!state.isGraduated) {
    return 'refunded';  // 未毕业，全额退款
  }
  
  if (bid.maxPrice > state.clearingPrice) {
    return 'fully_filled';  // 完全成交
  } else if (bid.maxPrice === state.clearingPrice) {
    return 'partially_filled';  // 部分成交
  } else {
    return 'outbid';  // 被淘汰
  }
}
```

---

### 4.7 模块七：Tick 链表可视化

#### 4.7.1 Tick 链表展示
```
┌─────────────────────────────────────────────────────────────┐
│  Tick 链表 (价格刻度)                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  底价                    清算价格              最高出价       │
│   ↓                         ↓                    ↓          │
│  [0.001]→[0.0015]→[0.002]→[0.0025]→[0.003]→[0.0035]→[MAX]  │
│    │        │        │        │        │        │           │
│   10ETH   25ETH    45ETH    30ETH    15ETH    5ETH          │
│   (2个)   (5个)    (8个)    (6个)    (3个)    (1个)          │
│                                                             │
│  ■ 清算价格上方  ░ 清算价格处  □ 清算价格下方(已淘汰)          │
└─────────────────────────────────────────────────────────────┘
```

#### 4.7.2 Tick 详情
```typescript
interface TickDisplay {
  price: number;
  demand: number;           // 该价格的总需求
  bidCount: number;         // 竞价数量
  isAboveClearing: boolean; // 是否在清算价格上方
  isAtClearing: boolean;    // 是否是清算价格
  fillRatio?: number;       // 如果是清算价格，显示成交比例
}
```


---

## 5. 核心算法实现

### 5.1 清算价格计算
```typescript
function calculateClearingPrice(state: SimulationState): number {
  const { totalSupply, floorPrice, tickSpacing } = state.config;
  
  // 如果没有需求，返回底价
  if (state.sumCurrencyDemandAboveClearing === 0) {
    return floorPrice;
  }
  
  // 计算理论清算价格
  let clearingPrice = state.sumCurrencyDemandAboveClearing / totalSupply;
  
  // 清算价格不能低于底价
  if (clearingPrice < floorPrice) {
    clearingPrice = floorPrice;
  }
  
  // 清算价格不能低于上一次的清算价格（只能上升）
  if (clearingPrice < state.clearingPrice) {
    clearingPrice = state.clearingPrice;
  }
  
  // 向上取整到 tick 边界
  clearingPrice = Math.ceil(clearingPrice / tickSpacing) * tickSpacing;
  
  return clearingPrice;
}
```

### 5.2 迭代更新清算价格（处理 Tick 跨越）
```typescript
function iterateAndFindClearingPrice(state: SimulationState): {
  clearingPrice: number;
  sumAboveClearing: number;
} {
  let sumAbove = state.sumCurrencyDemandAboveClearing;
  let nextTickPrice = state.nextActiveTickPrice;
  let minimumPrice = state.clearingPrice || state.config.floorPrice;
  
  const { totalSupply } = state.config;
  
  // 迭代检查是否需要跨越 tick
  while (nextTickPrice !== null) {
    // 检查当前需求是否足够推高价格到下一个 tick
    if (sumAbove >= totalSupply * nextTickPrice) {
      // 需求足够，减去该 tick 的需求，继续检查下一个
      const tick = state.ticks.get(nextTickPrice);
      if (tick) {
        sumAbove -= tick.currencyDemand;
        minimumPrice = nextTickPrice;
        nextTickPrice = tick.next;
      } else {
        break;
      }
    } else {
      break;
    }
  }
  
  // 计算精确清算价格
  let clearingPrice = sumAbove / totalSupply;
  
  // 确保不低于最小价格
  if (clearingPrice < minimumPrice) {
    clearingPrice = minimumPrice;
  }
  
  return { clearingPrice, sumAboveClearing: sumAbove };
}
```

### 5.3 提交竞价
```typescript
function submitBid(
  state: SimulationState, 
  maxPrice: number, 
  amount: number, 
  owner: string
): SimulationState {
  // 1. 验证
  const validation = validateBid({ maxPrice, amount }, state);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // 2. 计算有效需求（时间加权）
  const mpsRemaining = MPS_TOTAL - state.cumulativeMps;
  const effectiveAmount = amount * MPS_TOTAL / mpsRemaining;
  
  // 3. 创建竞价
  const bidId = state.bids.size;
  const bid: Bid = {
    id: bidId,
    maxPrice,
    amount,
    owner,
    startBlock: state.currentBlock,
    startCumulativeMps: state.cumulativeMps,
    effectiveAmount,
    status: 'active',
    tokensFilled: 0,
    currencySpent: 0,
    refund: 0,
  };
  
  // 4. 更新 Tick
  let tick = state.ticks.get(maxPrice);
  if (!tick) {
    tick = {
      price: maxPrice,
      currencyDemand: 0,
      bidIds: [],
      next: findNextTick(state, maxPrice),
    };
    // 插入到链表中
    insertTickIntoList(state, tick);
  }
  tick.currencyDemand += effectiveAmount;
  tick.bidIds.push(bidId);
  
  // 5. 更新全局需求
  const newSumDemand = state.sumCurrencyDemandAboveClearing + effectiveAmount;
  
  // 6. 重新计算清算价格
  const { clearingPrice } = iterateAndFindClearingPrice({
    ...state,
    sumCurrencyDemandAboveClearing: newSumDemand,
  });
  
  // 7. 返回新状态
  return {
    ...state,
    bids: new Map(state.bids).set(bidId, bid),
    ticks: new Map(state.ticks).set(maxPrice, tick),
    sumCurrencyDemandAboveClearing: newSumDemand,
    clearingPrice,
  };
}
```

### 5.4 代币销售计算
```typescript
function sellTokensAtClearingPrice(
  state: SimulationState,
  deltaMps: number,
  clearingPrice: number
): { currencyRaised: number; totalCleared: number } {
  const { totalSupply, tickSpacing } = state.config;
  
  // 基础情况：所有需求都在清算价格之上
  let currencyFromAbove = state.sumCurrencyDemandAboveClearing * deltaMps / MPS_TOTAL;
  
  // 特殊情况：清算价格正好在某个 tick 上
  if (clearingPrice % tickSpacing === 0) {
    const tick = state.ticks.get(clearingPrice);
    if (tick && tick.currencyDemand > 0) {
      // 计算在清算价格处的贡献
      const totalCurrencyForDelta = totalSupply * clearingPrice * deltaMps / MPS_TOTAL;
      const currencyRaisedAbove = (state.sumCurrencyDemandAboveClearing - tick.currencyDemand) 
                                   * deltaMps / MPS_TOTAL;
      const demandAtClearing = totalCurrencyForDelta - currencyRaisedAbove;
      const expectedAtTick = tick.currencyDemand * deltaMps / MPS_TOTAL;
      
      // 取较小值
      const currencyAtClearing = Math.min(demandAtClearing, expectedAtTick);
      currencyFromAbove = currencyRaisedAbove + currencyAtClearing;
    }
  }
  
  // 转换为代币数量
  const tokensCleared = currencyFromAbove / clearingPrice;
  
  return {
    currencyRaised: state.currencyRaised + currencyFromAbove,
    totalCleared: state.totalCleared + tokensCleared,
  };
}
```


### 5.5 竞价结算计算
```typescript
function settleBid(bid: Bid, state: SimulationState): SettlementResult {
  // 未毕业 - 全额退款
  if (!state.isGraduated) {
    return {
      tokensFilled: 0,
      currencySpent: 0,
      refund: bid.amount,
      status: 'refunded',
    };
  }
  
  const finalClearingPrice = state.clearingPrice;
  
  // 完全成交（出价高于清算价格）
  if (bid.maxPrice > finalClearingPrice) {
    return calculateFullyFilledSettlement(bid, state);
  }
  
  // 部分成交（出价等于清算价格）
  if (bid.maxPrice === finalClearingPrice) {
    return calculatePartiallyFilledSettlement(bid, state);
  }
  
  // 被淘汰（出价低于清算价格）- 理论上不应该发生
  return {
    tokensFilled: 0,
    currencySpent: 0,
    refund: bid.amount,
    status: 'outbid',
  };
}

function calculateFullyFilledSettlement(bid: Bid, state: SimulationState): SettlementResult {
  // 使用累计 mps/price 计算代币分配
  const startCheckpoint = state.checkpoints.get(bid.startBlock);
  const endCheckpoint = state.checkpoints.get(state.config.endBlock);
  
  if (!startCheckpoint || !endCheckpoint) {
    throw new Error('Checkpoint not found');
  }
  
  const mpsRemaining = MPS_TOTAL - bid.startCumulativeMps;
  const deltaMpsPerPrice = endCheckpoint.cumulativeMpsPerPrice - startCheckpoint.cumulativeMpsPerPrice;
  const deltaMps = endCheckpoint.cumulativeMps - startCheckpoint.cumulativeMps;
  
  // 代币数量 = 竞价金额 × Δ(mps/price) / 剩余MPS
  const tokensFilled = bid.amount * deltaMpsPerPrice / mpsRemaining;
  
  // 花费金额 = 竞价金额 × ΔcumulativeMps / 剩余MPS
  const currencySpent = bid.amount * deltaMps / mpsRemaining;
  
  return {
    tokensFilled,
    currencySpent,
    refund: bid.amount - currencySpent,
    status: 'fully_filled',
  };
}

function calculatePartiallyFilledSettlement(bid: Bid, state: SimulationState): SettlementResult {
  // 部分成交按比例分配
  const tick = state.ticks.get(bid.maxPrice);
  if (!tick) {
    throw new Error('Tick not found');
  }
  
  // 该竞价在 tick 中的占比
  const bidShare = bid.effectiveAmount / tick.currencyDemand;
  
  // 在清算价格处募集的总资金
  const endCheckpoint = state.checkpoints.get(state.config.endBlock);
  const currencyRaisedAtClearing = endCheckpoint?.currencyRaisedAtClearingPrice || 0;
  
  // 按比例分配
  const currencySpent = currencyRaisedAtClearing * bidShare;
  const tokensFilled = currencySpent / state.clearingPrice;
  
  return {
    tokensFilled,
    currencySpent,
    refund: bid.amount - currencySpent,
    status: 'partially_filled',
  };
}
```

### 5.6 MPS 计算辅助函数
```typescript
const MPS_TOTAL = 10_000_000; // 1e7 = 100%

// 获取当前 Step
function getCurrentStep(config: AuctionConfig, block: number): AuctionStep & { index: number } {
  let currentBlock = config.startBlock;
  
  for (let i = 0; i < config.steps.length; i++) {
    const step = config.steps[i];
    const stepEndBlock = currentBlock + step.blockDelta;
    
    if (block < stepEndBlock) {
      return {
        ...step,
        index: i,
        startBlock: currentBlock,
        endBlock: stepEndBlock,
      };
    }
    
    currentBlock = stepEndBlock;
  }
  
  // 返回最后一个 step
  const lastStep = config.steps[config.steps.length - 1];
  return {
    ...lastStep,
    index: config.steps.length - 1,
  };
}

// 计算某区块的累计 MPS
function calculateCumulativeMps(config: AuctionConfig, block: number): number {
  if (block <= config.startBlock) return 0;
  if (block >= config.endBlock) return MPS_TOTAL;
  
  let cumulativeMps = 0;
  let currentBlock = config.startBlock;
  
  for (const step of config.steps) {
    const stepEndBlock = currentBlock + step.blockDelta;
    
    if (block <= stepEndBlock) {
      // 在当前 step 内
      const blocksInStep = block - currentBlock;
      cumulativeMps += step.mps * blocksInStep;
      break;
    } else {
      // 完整经过这个 step
      cumulativeMps += step.mps * step.blockDelta;
      currentBlock = stepEndBlock;
    }
  }
  
  return cumulativeMps;
}

// 计算累计 mps/price
function calculateCumulativeMpsPerPrice(
  checkpoints: Map<number, Checkpoint>,
  fromBlock: number,
  toBlock: number
): number {
  // 遍历检查点累加
  let sum = 0;
  for (const [block, cp] of checkpoints) {
    if (block > fromBlock && block <= toBlock) {
      // 简化计算：假设每个检查点的 mps/price 贡献
      // 实际实现需要更精确的计算
      sum += cp.cumulativeMpsPerPrice;
    }
  }
  return sum;
}
```


---

## 6. 预设场景

### 6.1 场景列表

| 场景名称 | 描述 | 用途 |
|----------|------|------|
| 冷启动 | 少量竞价，价格在底价附近 | 观察低需求时的行为 |
| 热门拍卖 | 大量竞价，价格快速上涨 | 观察高需求时的价格发现 |
| 毕业边缘 | 募资接近毕业门槛 | 观察毕业判定逻辑 |
| 未毕业 | 募资不足 | 观察全额退款场景 |
| 部分成交 | 多个竞价在清算价格处 | 观察部分成交分配逻辑 |
| 价格阶梯 | 竞价均匀分布在各价格 | 观察 Tick 链表行为 |
| 时间加权 | 不同时间点的相同竞价 | 观察时间加权效果 |
| 大户冲击 | 单笔大额竞价 | 观察价格冲击效果 |

### 6.2 场景配置示例

```typescript
const PRESET_SCENARIOS = {
  coldStart: {
    name: '冷启动',
    description: '少量竞价，价格在底价附近',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      { block: 100, maxPrice: 0.0012, amount: 5, owner: 'User_1' },
      { block: 500, maxPrice: 0.0011, amount: 3, owner: 'User_2' },
      { block: 1000, maxPrice: 0.0015, amount: 8, owner: 'User_3' },
    ],
  },
  
  hotAuction: {
    name: '热门拍卖',
    description: '大量竞价，价格快速上涨',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: generateRandomBids({
      count: 100,
      priceRange: [0.001, 0.01],
      amountRange: [1, 50],
      blockRange: [0, 5000],
    }),
  },
  
  graduationEdge: {
    name: '毕业边缘',
    description: '募资接近毕业门槛',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      requiredCurrencyRaised: 100,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      // 总需求约 95-105 ETH，接近 100 ETH 门槛
      { block: 100, maxPrice: 0.002, amount: 30, owner: 'User_1' },
      { block: 500, maxPrice: 0.0025, amount: 25, owner: 'User_2' },
      { block: 1000, maxPrice: 0.003, amount: 20, owner: 'User_3' },
      { block: 2000, maxPrice: 0.0022, amount: 23, owner: 'User_4' },
    ],
  },
  
  partialFill: {
    name: '部分成交',
    description: '多个竞价在清算价格处部分成交',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      requiredCurrencyRaised: 50,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      // 多个竞价在同一价格，会部分成交
      { block: 100, maxPrice: 0.002, amount: 20, owner: 'User_1' },
      { block: 200, maxPrice: 0.002, amount: 15, owner: 'User_2' },
      { block: 300, maxPrice: 0.002, amount: 25, owner: 'User_3' },
      { block: 400, maxPrice: 0.002, amount: 10, owner: 'User_4' },
    ],
  },
  
  timeWeighting: {
    name: '时间加权对比',
    description: '相同金额在不同时间提交的效果对比',
    config: {
      totalSupply: 1_000_000,
      floorPrice: 0.001,
      tickSpacing: 0.0001,
      startBlock: 0,
      endBlock: 10000,
      requiredCurrencyRaised: 50,
      steps: [{ mps: 1000, blockDelta: 10000 }],
    },
    bids: [
      // 相同金额，不同时间
      { block: 100, maxPrice: 0.003, amount: 10, owner: 'Early_User' },   // 早期
      { block: 5000, maxPrice: 0.003, amount: 10, owner: 'Mid_User' },    // 中期
      { block: 9000, maxPrice: 0.003, amount: 10, owner: 'Late_User' },   // 晚期
    ],
  },
};
```

### 6.3 场景加载器
```
┌─────────────────────────────────────────────────────────────┐
│  预设场景                                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │  冷启动     │ │  热门拍卖   │ │  毕业边缘   │            │
│  │  少量竞价   │ │  大量竞价   │ │  接近门槛   │            │
│  │  [加载]     │ │  [加载]     │ │  [加载]     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │  未毕业     │ │  部分成交   │ │  时间加权   │            │
│  │  全额退款   │ │  比例分配   │ │  效果对比   │            │
│  │  [加载]     │ │  [加载]     │ │  [加载]     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│  [导入自定义场景]  [导出当前场景]                             │
└─────────────────────────────────────────────────────────────┘
```


---

## 7. 页面布局

### 7.1 整体布局
```
┌─────────────────────────────────────────────────────────────────────────┐
│  CCA 可视化模拟器                              [预设场景▼] [重置] [导出] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        时间轴控制器                              │   │
│  │  [|◀] [◀] [▶/⏸] [▶|] [▶▶]    Block: 3456 / 10000               │   │
│  │  ├──────────────●────────────────────────────────────────────┤   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌───────────────────────────┐  ┌───────────────────────────────────┐  │
│  │      配置面板              │  │           状态仪表盘              │  │
│  │  ┌─────────────────────┐  │  │  ┌─────────┐ ┌─────────┐         │  │
│  │  │ 拍卖参数配置        │  │  │  │清算价格 │ │已募资金 │         │  │
│  │  │ totalSupply: [...] │  │  │  │ 0.0023  │ │ 156 ETH │         │  │
│  │  │ floorPrice: [...]  │  │  │  └─────────┘ └─────────┘         │  │
│  │  │ ...                │  │  │  ┌─────────┐ ┌─────────┐         │  │
│  │  └─────────────────────┘  │  │  │已清算   │ │毕业状态 │         │  │
│  │  ┌─────────────────────┐  │  │  │ 670K   │ │ ✓ 已毕业│         │  │
│  │  │ 释放时间表配置      │  │  │  └─────────┘ └─────────┘         │  │
│  │  │ [释放曲线预览图]    │  │  └───────────────────────────────────┘  │
│  │  └─────────────────────┘  │                                         │
│  └───────────────────────────┘                                         │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                          图表区域                                  │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐ │ │
│  │  │    清算价格走势图        │  │       需求分布柱状图            │ │ │
│  │  │                         │  │                                 │ │ │
│  │  └─────────────────────────┘  └─────────────────────────────────┘ │ │
│  │  ┌─────────────────────────┐  ┌─────────────────────────────────┐ │ │
│  │  │    代币释放进度图        │  │       募资进度环形图            │ │ │
│  │  │                         │  │                                 │ │ │
│  │  └─────────────────────────┘  └─────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────┐  ┌───────────────────────────────────┐  │
│  │      模拟出价面板          │  │           竞价列表                │  │
│  │  出价者: [User_1 ▼]       │  │  ID | 出价者 | 价格 | 金额 | 状态 │  │
│  │  最高出价: [0.0025]       │  │  1  | User_1 | 0.003| 15  | ✓    │  │
│  │  竞价金额: [10]           │  │  2  | User_2 | 0.002| 10  | ◐    │  │
│  │  [提交出价]               │  │  3  | User_3 | 0.001| 8   | ✗    │  │
│  │                           │  │  ...                              │  │
│  │  [批量生成竞价]           │  │                                   │  │
│  └───────────────────────────┘  └───────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 响应式适配

**桌面端 (≥1200px)：** 如上图所示的多列布局

---

## 8. 交互流程

### 8.1 基本使用流程
```
1. 配置拍卖参数
   ├── 设置基础参数（totalSupply, floorPrice 等）
   ├── 配置释放时间表
   └── 或选择预设场景

2. 开始模拟
   ├── 点击播放按钮自动推进
   └── 或手动控制区块前进

3. 模拟出价
   ├── 手动添加单个竞价
   └── 或批量生成随机竞价

4. 观察结果
   ├── 查看清算价格变化
   ├── 查看需求分布
   ├── 查看募资进度
   └── 查看各竞价状态

5. 拍卖结束
   ├── 查看最终清算价格
   ├── 查看毕业状态
   └── 查看各竞价结算结果
```

### 8.2 关键交互点

| 交互 | 触发条件 | 效果 |
|------|----------|------|
| 提交竞价 | 点击"提交出价" | 更新需求、重算清算价格、刷新图表 |
| 推进区块 | 点击前进或自动播放 | 更新累计MPS、重算状态、创建检查点 |
| 修改参数 | 编辑配置项 | 重置模拟、应用新参数 |
| 加载场景 | 选择预设场景 | 重置并加载场景配置和竞价 |
| 查看详情 | 点击竞价行 | 弹出竞价详情面板 |
| 导出数据 | 点击导出 | 下载当前状态为 JSON |


---

## 9. 数据导入导出

### 9.1 导出格式
```typescript
interface ExportData {
  version: string;
  exportTime: string;
  
  // 配置
  config: AuctionConfig;
  
  // 当前状态
  state: {
    currentBlock: number;
    clearingPrice: number;
    currencyRaised: number;
    totalCleared: number;
    cumulativeMps: number;
    isGraduated: boolean;
  };
  
  // 所有竞价
  bids: Array<{
    id: number;
    maxPrice: number;
    amount: number;
    owner: string;
    startBlock: number;
    status: string;
    tokensFilled: number;
    currencySpent: number;
  }>;
  
  // 检查点历史
  checkpoints: Array<{
    blockNumber: number;
    clearingPrice: number;
    cumulativeMps: number;
    currencyRaised: number;
  }>;
}
```

### 9.2 导入验证
```typescript
function validateImportData(data: unknown): ValidationResult {
  // 1. 检查必要字段
  // 2. 验证数据类型
  // 3. 验证数值范围
  // 4. 验证逻辑一致性（如 steps 总和 = 1e7）
  return { valid: true, errors: [] };
}
```

---

## 10. 常量定义

```typescript
// 核心常量
const CONSTANTS = {
  MPS_TOTAL: 10_000_000,        // 1e7 = 100%
  
  // 价格限制
  MIN_FLOOR_PRICE: 4294967297,  // 2^32 + 1 (实际合约值，可简化为小数)
  MIN_TICK_SPACING: 2,
  
  // 供应量限制
  MAX_TOTAL_SUPPLY: 2 ** 100,
  
  // 显示用简化值（用于 UI）
  DISPLAY: {
    MIN_FLOOR_PRICE: 0.0001,    // 简化显示
    DEFAULT_FLOOR_PRICE: 0.001,
    DEFAULT_TICK_SPACING: 0.0001,
    DEFAULT_TOTAL_SUPPLY: 1_000_000,
    DEFAULT_REQUIRED_RAISED: 100,
  },
};

// 状态颜色
const STATUS_COLORS = {
  active: '#1890ff',        // 蓝色 - 活跃
  fully_filled: '#52c41a',  // 绿色 - 完全成交
  partially_filled: '#faad14', // 橙色 - 部分成交
  outbid: '#ff4d4f',        // 红色 - 被淘汰
  refunded: '#d9d9d9',      // 灰色 - 已退款
};

// 图表颜色
const CHART_COLORS = {
  clearingPrice: '#1890ff',
  floorPrice: '#ff4d4f',
  demandAbove: '#52c41a',
  demandAt: '#faad14',
  demandBelow: '#d9d9d9',
  plannedRelease: '#1890ff',
  actualRelease: '#52c41a',
};
```

---

## 11. 开发优先级

### Phase 1：核心功能 (MVP)
1. ✅ 基础配置面板（参数输入）
2. ✅ 时间轴控制器（区块推进）
3. ✅ 清算价格计算逻辑
4. ✅ 手动出价功能
5. ✅ 状态仪表盘（核心指标）
6. ✅ 竞价列表

### Phase 2：可视化增强
1. ✅ 清算价格走势图
2. ✅ 需求分布柱状图
3. ✅ 代币释放进度图
4. ✅ 募资进度环形图
5. ✅ 释放时间表配置器（可视化编辑）

### Phase 3：高级功能
1. ✅ 预设场景
2. ✅ 批量出价生成器
3. ✅ 竞价详情面板
4. ✅ Tick 链表可视化
5. ✅ 数据导入导出

### Phase 4：优化完善
1. ✅ 响应式布局
2. ✅ 动画效果
3. ✅ 性能优化
4. ✅ 使用教程/引导

*文档版本：2.0*
*最后更新：2024年12月*
*用途：纯前端 CCA 模拟器开发需求*
