# McBuddy AI 架构说明

> 本文档基于仓库的**真实代码状态**撰写。
> 所有标为「已实现」的内容都可在代码中定位；标为「尚未实现」的内容确认不存在。

---

## 一、总览

McBuddy AI 是一个**本地优先的单机应用**：一个 FastAPI 进程同时提供 API 与前端静态托管，
整个产品只需一个端口、一条命令即可运行。

设计上刻意做了三个减法：

| 减法 | 原因 |
|---|---|
| 不做账号系统 | 无服务端会话，状态全部在浏览器 localStorage，换设备用导出迁移 |
| 不做服务端渲染 | 前端静态导出，产物入库，访客不需要 Node.js |
| 不引入重型依赖 | 后端仅 4 个依赖；雷达图手写 SVG 而非引图表库 |

```
┌──────────────────────────────────────────────────────┐
│  浏览器  http://127.0.0.1:8000                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Next.js 14 静态导出（纯客户端 React）           │  │
│  │  /  /personality  /analysis  /result           │  │
│  │  /buddy  /share                                │  │
│  └────────────────────────────────────────────────┘  │
│              │ localStorage（唯一状态源）             │
└──────────────┼───────────────────────────────────────┘
               │ 仅首页读取一次运行模式
┌──────────────▼───────────────────────────────────────┐
│  FastAPI 单进程                                       │
│   GET /health   健康检查（启动器探活用）              │
│   GET /api      运行模式快照                          │
│   GET /*        静态托管 frontend/out                 │
└──────────────────────────────────────────────────────┘
```

---

## 二、运行形态

### 启动链路

```
start.bat / start.sh      ← 纯 ASCII 外壳，只做一件事：找到 Python
      ↓
scripts/launch.py         ← 真正的启动逻辑（跨平台共用）
      1. 校验 Python ≥ 3.10
      2. 无 .venv 则创建
      3. pip install -r backend/requirements.txt
      4. 用 venv 解释器 os.execv 重新执行自身
      5. 无 .env 则从 .env.example 复制
      6. 启动 uvicorn，轮询 /health 就绪
      7. 打开浏览器
```

**为什么 `start.bat` 只有几行**：cmd.exe 解析含非 ASCII 字符的 `.bat` 文件不可靠——
在 UTF-8 代码页下会**错切行**，把 `http://127.0.0.1:8000` 截断成 `7.0.0.1`，
把中文标点当成命令执行。因此批处理只保留纯 ASCII 的最小逻辑，实际工作交给 Python。
这样 Windows 与 macOS/Linux 还能共用同一份启动代码。

### 依赖清单

| 端 | 依赖 |
|---|---|
| 后端 | `fastapi` `uvicorn` `python-dotenv` `pydantic`（4 个） |
| 前端运行时 | `next` `react` `react-dom` `framer-motion` `html-to-image` |
| 访客需要 | **仅 Python 3.10+** |

---

## 三、前端渲染策略（已实现）

### 静态导出

`next.config.mjs` 三项配置：

```js
output: "export",              // 产物输出到 frontend/out
images: { unoptimized: true }, // 静态导出无 Node 服务端，必须关闭图片优化
trailingSlash: true,           // 每个路由生成 xxx/index.html
```

`trailingSlash` 是关键：纯静态服务器（FastAPI StaticFiles）只有把 `/result` 映射到
`result/index.html` 才能正确响应子路径。**全站站内跳转因此统一使用带尾斜杠的路径。**
（实测：无尾斜杠访问返回 307，自动重定向到带斜杠版本。）

### 为什么状态放 localStorage

静态导出后，页面之间是**真实的导航**。React Context 在刷新或直接粘贴 URL 时会丢失，
因此跨页状态必须落地。`lib/store.ts` 提供三个带版本前缀的键：

| 键 | 内容 | 实测体积 |
|---|---|---|
| `mcbuddy.v1.answers` | 六题作答 | 94 B |
| `mcbuddy.v1.persona` | 人格结果（代号 / 向量 / 置信度 / 混合型） | 222 B |
| `mcbuddy.v1.profile` | 档案展示数据 | 262 B |

版本前缀是为将来接入真实 Memory 时能做数据迁移，避免用户旧数据导致崩溃。

### hydration 安全的两条硬性规则

这是本项目最容易踩坑的地方，两条规则贯穿所有页面：

1. **所有 store 读取函数必须 SSR 安全** —— 预渲染时 `window` 不存在，必须返回 `null` 而非抛错。
2. **页面中的读取必须放在 `useEffect` 内** —— 若在渲染期读取，服务端（无数据）与客户端首帧
   （有数据）产出的 HTML 不一致，React 会报 hydration mismatch。

### 首屏内容的取舍

| 页面 | 静态 HTML 内容 | 原因 |
|---|---|---|
| `/` | 完整内容 | 不依赖任何状态 |
| `/personality` | **完整第 1 题** | 初始状态固定为「第 1 题 + 空作答」，与服务端一致；已答过的用户在 effect 中还原到第一道未答题 |
| `/analysis` `/result` `/buddy` `/share` | 仅占位文案 | 内容完全依赖 localStorage，无法预渲染 |

---

## 四、状态链（已实现）

```
[空状态] 三键均为 null
   │
   │  /personality：每选一题立即 saveAnswers()
   ▼
answers (1/6 → 6/6)   ←── 刷新后 readAnswers() 还原，跳到第一道未答题
   │
   │  /analysis：readAnswers() → scoreAnswers() → savePersona() + saveProfile()
   ▼
persona + profile     ★ 全站唯一写入人格的位置
   │
   ├─ /result   readPersona()
   ├─ /buddy    readPersona() + readProfile()
   └─ /share    readPersona() + readProfile() + readAnswers() → deriveContext()
```

**为什么把写入集中在 `/analysis`**：避免多处写导致状态竞争与不一致。
审计已确认调用点分布如下：

| 页面 | 读取 | 写入 |
|---|---|---|
| `/` | — | — |
| `/personality/` | `readAnswers` | `saveAnswers` |
| `/analysis/` | `readAnswers` | `savePersona` `saveProfile` |
| `/result/` | `readPersona` | — |
| `/buddy/` | `readPersona` `readProfile` | — |
| `/share/` | `readAnswers` `readPersona` `readProfile` | — |

### 兜底策略

| 页面 | 无数据时行为 |
|---|---|
| `/analysis` | `router.replace('/personality/')` |
| `/result` | `router.replace('/personality/')` |
| `/share` | `router.replace('/personality/')` |
| `/buddy` | **不跳走**，用默认人格渲染示例档案 + 顶部提示（对直接访问者更友好） |

---

## 五、人格匹配算法（已实现）

### 数据模型

```
6 道题 ──1:1──> 6 个维度 ──匹配──> 8 个人格原型
```

**一题恰好驱动一个维度**，这是刻意的设计：领域取值直接来自所选选项，而非多题增量叠加，
因此结果页可以解释「你的某一维来自第几题」，雷达图上的每个数字都可追溯。

六个维度：`happiness_need` `spending` `taste` `adventure` `social` `recovery`（各取值 0–1）。

### 溢出（spillover）机制

选项除主维度外可对相邻维度产生次级影响，例如选「🍦 甜品」会同时拉高 `recovery`。
实现要点：**溢出统一在主维度赋值之后施加**，融合权重 0.35，保证结果与选项遍历顺序无关。

### 中心化余弦相似度（核心）

```
① 构建六维向量（主维度赋值 + 溢出融合，裁剪到 [0,1]）
② 每维减去中位值 0.5 做中心化
③ 与 8 个原型算余弦相似度，映射到 [0,1]
④ 取 Top1 为本命人格
⑤ Top1 与 Top2 差值 < 0.02 → 判定混合型（双人格）
⑥ 置信度 = 差值映射到 60–99
```

**为什么必须中心化**——这是整个算法里唯一的技术难点：

所有向量都落在 `[0,1]⁶` 的**正象限**内。普通余弦相似度在这种情况下会让任意两个向量
都得到 0.9 以上的分数（因为它们的夹角天然很小），8 种人格彼此无法区分。
减去中位值 0.5 之后，向量被搬到以原点为中心的坐标系，等价于 **Pearson 相关系数**，
区分度立刻拉开。

### 混合型阈值的标定

阈值不是拍脑袋定的，而是**穷举全部 6144 种作答组合**后标定：

| 阈值 | 混合型占比 | 判断 |
|---|---|---|
| 0.05 | 40.2% | 太泛滥，稀释「我有一个身份」的感觉 |
| **0.02** | **17.9%** | ✅ 采用。约 1/5.5，既有特别感又不常见 |
| 0.01 | 9.5% | 过于稀有，多数人无法体验 |

### 八型可达性

穷举 6144 组作答后的分布（`scripts/verify-personas.ts`）：

```
🍟 黄金薯条治愈者   559 组 ( 9.1%)      🍦 甜品疗愈师    1279 组 (20.8%)
☕ 咖啡续命玩家     392 组 ( 6.4%)      💰 精打细算麦友   582 组 ( 9.5%)
🍔 巨无霸掌控者     629 组 (10.2%)      👥 分享快乐玩家  1302 组 (21.2%)
🌶 麦辣冒险家       800 组 (13.0%)      🧑‍💻 深夜代码战士   601 组 ( 9.8%)
```

**8 / 8 可达**，不存在永远测不出来的死人格。分布不完全均匀（6.4%–21.2%），
这反映的是题目设计本身，而非缺陷——本产品**不伪造人群统计**。

---

## 六、人格主题系统（已实现）

`lib/theme.ts` 把人格的 `gradient` 三元组（`from` / `to` / `accent`）派生成一整套 UI 主题：

| 主题字段 | 派生自 | 用途 |
|---|---|---|
| `from` `to` `accent` | 原样 | — |
| `glow` | `accent` | 海报中 emoji 背后的柔光 |
| `background` | `from` → 透明 | 页面背景径向渐变 |
| `cardGradient` | `from` → `to` 135° | 卡片与海报主渐变 |
| `ring` | `accent` @ 20% | 描边 |

**为什么不给 `Persona` 加字段**：人格数据属核心资产，保持冻结。派生方案让 8 种人格
自动获得 8 套视觉，**零数据改动**，且映射规则只有一处。

### 两套配色策略（刻意不同）

| | `PersonalityCard`（结果页） | `SharePoster`（发布物） |
|---|---|---|
| 策略 | 顶部渐变带 + 下方深色正文区 | 全幅渐变 + 自下而上暗色蒙版 |
| 原因 | 列表页可读性优先 | 发布物需要饱和冲击 |

原因是 8 种人格的渐变里**既有高亮黄 `#FFC72C` 也有深蓝 `#0B4F8A`**——
白字直接压在整块渐变上，在黄色人格上对比度会严重不足。两套策略分别解决了各自的场景。

---

## 七、组件清单

`frontend/components/` 共 10 个组件，职责边界刻意收窄：

### 设计系统层

| 组件 | 职责 | 关键 props |
|---|---|---|
| `ScreenShell` | 页面外壳：内边距、最大宽度、`min-h-[100dvh]` | `center` `maxWidth` |
| `GradientBackground` | 渐变光晕背景（色相可配） | `from` `to` `intensity` |
| `PrimaryButton` | 主按钮（按钮 / 链接双形态） | `href` `onClick` `variant` `size` |
| `RadarChart` | 六维雷达，**纯手写 SVG** | `vector` `accent` `animated` |
| `StepDots` | 进度点 + 题号计数 | `total` `current` `showCounter` |

### 业务层

| 组件 | 职责 | 明确不负责 |
|---|---|---|
| `QuestionCard` | 单题展示、选项、点击 | ❌ 评分逻辑 ❌ 不知道自己第几题 |
| `AnalysisAnimation` | 四步动画，2.6s 后回调 | ❌ 不参与任何计算 |
| `PersonalityCard` | 人格展示卡 | ❌ 数据获取 |
| `BuddyProfile` | 档案展示 | ❌ 推导 |
| `SharePoster` | 3:4 海报，无交互元素 | ❌ 导出逻辑（在页面里） |

**题目切换的 `AnimatePresence` 放在页面而非 `QuestionCard`**——因为「当前第几题」
属于页面状态。这样卡片才能保持"只管展示"的纯净职责。

---

## 八、后端职责与边界（已实现）

`backend/main.py` 只做三件事：

| 路由 | 作用 |
|---|---|
| `GET /health` | 启动器轮询探活 |
| `GET /api` | 返回运行模式快照（`{name, version, mode, llm, mcp}`） |
| `GET /*` | 静态托管 `frontend/out` |

**一个关键的实现细节**：路由注册顺序是**先 API、最后 mount 静态目录**。
Starlette 按注册顺序匹配，顺序反了 `/health` 会被静态目录吞掉，启动脚本的探活就永远失败。

未构建前端时 `/` 会返回带 `hint` 的 JSON，而不是让人对着 404 发懵。

`backend/config.py` 的所有配置都带默认值，`.env` 不存在时静默跳过——
**删掉 `.env` 也能跑**，Demo Mode 不会因配置缺失而启动失败。

---

## 九、MCP 集成（已接入）

> ✅ 本节描述的是**已实现并经过真实调用验证**的能力。
> 完整的工具清单、验证矩阵与安全说明见 [`../MCP_INTEGRATION.md`](../MCP_INTEGRATION.md)。

### 分层

```
页面 /recommend
   │  只发送人格向量与预算，不含任何凭证
   ▼
backend/api/recommend.py      三个只读接口：menu / promotions / calculate
   ▼
backend/mcp/adapter.py        Provider 选择 + 失败降级 + source 标记
   │
   ├── MCBUDDY_MCP=fixture ──► mock_provider.py ──► fixtures/*.json
   │
   └── MCBUDDY_MCP=live ─────► live_provider.py
                                    │  Streamable HTTP + JSON-RPC 2.0
                                    │  Authorization: Bearer <MCD_MCP_TOKEN>
                                    ▼
                             https://mcp.mcd.cn
```

`backend/mcp/` 各文件职责：

| 文件 | 职责 |
|---|---|
| `config.py` | **唯一**读取 MCP 环境变量的地方（Token / 模式 / base_url） |
| `adapter.py` | Provider 选择、异常捕获、降级、`source` 诚实标记 |
| `live_provider.py` | 真实 MCP：握手、工具调用、门店解析、缓存 |
| `mock_provider.py` | 演示数据，同时是降级目标 |
| `normalize.py` | 外部数据 → schema（信封解包、字段容错、表格解析、轴推导） |
| `schemas.py` | Pydantic 数据契约，与前端 `lib/provider/types.ts` 一一对应 |
| `errors.py` | 异常体系（独立成模块以避开循环导入） |

### 真实调用链

`query-meals` / `query-store-coupons` / `calculate-price` 都**强制要求 `storeCode`**，
因此链路是「先解析门店，再查数据」：

```
query-nearby-stores { beType:1, searchType:1 }   → storeCode（缓存 600s）
        ↓
query-meals          { storeCode, orderType:1, beType:1 }
query-store-coupons  { storeCode, orderType:1, beType:1 }
calculate-price      { storeCode, orderType:1, beType:1,
                       items:[{ productCode, quantity }] }
```

> `calculate-price` 的商品字段是 `productCode` + `quantity`（不是 `code` + `qty`），
> 定义取自 `tools/list` 的 `inputSchema`。

### 三层降级

| 层 | 触发条件 | 结果 |
|---|---|---|
| 前端 Provider | 后端不可用 / 超时 4s | 改用前端本地 Mock |
| Adapter | Live 抛任何 `McpError` | 改用后端 MockProvider |
| Provider | 门店打烊、无券等业务限制 | 抛 `McpBusinessError` → 上层降级 |

**降级时 `source` 一律标记为 `"mock"`**，前端据此显示「演示数据」徽标。
实测：门店打烊时 `/api/recommend/menu` 返回 12 条演示菜单且 `source=mock`，页面不白屏。

### 只读与隐私

仅接入查询类工具。**已禁用**全部有副作用的工具（下单 / 领券 / 抽奖 / 扣积分 / 写地址），
以及会返回**个人隐私数据**的 `delivery-query-addresses`（实测返回收件人姓名、手机号、住址）。

> **命名说明**：MCP 实现在 `backend/mcp/`，位于 `backend.` 命名空间下，
> 与 MCP 官方 Python SDK 的 `mcp` 包**不冲突**。
> （Phase 2 遗留的根目录 `mcp/` 占位包已删除，避免遮蔽官方 SDK。）

### 脱敏要求

若将真实响应存为 `fixtures/` 快照，必须移除：Token、手机号、配送地址、订单号、个人标识。

---

## 十、已实现 / 未实现边界

| 能力 | 状态 | 实现位置 |
|---|---|---|
| 七页完整流程 | ✅ 已实现 | `frontend/app/` |
| 六维人格模型 | ✅ 已实现 | `frontend/data/questions.ts` |
| 匹配算法 | ✅ 已实现 | `frontend/lib/scoring.ts` |
| 8 型人格数据与文案 | ✅ 已实现 | `frontend/data/personas.ts` |
| 本地状态与刷新恢复 | ✅ 已实现 | `frontend/lib/store.ts` |
| 雷达图 | ✅ 已实现 | `frontend/components/RadarChart.tsx` |
| 人格主题派生 | ✅ 已实现 | `frontend/lib/theme.ts` |
| 海报与 PNG 导出 | ✅ 已实现 | `SharePoster.tsx` + `app/share/page.tsx` |
| 推荐引擎（五轴打分 + 券组合） | ✅ 已实现 | `frontend/lib/recommend.ts` |
| 数据源抽象（HTTP 优先 + Mock 兜底） | ✅ 已实现 | `frontend/lib/provider/` |
| 一键启动 | ✅ 已实现 | `start.bat` + `scripts/launch.py` |
| **麦当劳 MCP 真实调用** | ✅ 已接入并验证 | `backend/mcp/` |
| **推荐数据接口** | ✅ 已实现 | `backend/api/recommend.py` |
| **失败自动降级 + source 诚实标记** | ✅ 已实现 | `backend/mcp/adapter.py` |
| **LLM 对话** | ❌ 未实现 | — |
| **Agent 六阶段管线** | ❌ 未实现 | 规划于 `agent/` |
| **长期记忆 L1–L4** | ❌ 未实现 | 规划于 `memory/` |
| **SQLite 持久化** | ❌ 未实现 | `database/schema.sql` 仅含版本表 |

---

## 十一、构建与部署

### 构建

```bash
cd frontend && pnpm install && pnpm build   # 产物：frontend/out（约 1.1 MB，41 个文件）
```

前端产物**随仓库提交**（`frontend/.gitignore` 中刻意未忽略 `/out/`），
这是"访客零 Node"承诺的兑现物。

### 部署形态

| 场景 | 方式 |
|---|---|
| 本地演示（主） | 双击 `start.bat` → `http://127.0.0.1:8000` |
| 手动 | `uvicorn backend.main:app --host 127.0.0.1 --port 8000` |

FastAPI 单进程同时提供 API 与静态托管，**不需要额外的 Web 服务器**。

---

## 十二、已知限制

| # | 限制 | 说明 |
|---|---|---|
| 1 | 无账号，状态仅存于当前浏览器 | 换设备需重新测试；未来可用导出码迁移 |
| 2 | 4 个页面静态 HTML 仅有占位 | 内容依赖 localStorage，属架构必然 |
| 3 | 口味字段目前为 Mock 默认值 | `buildProfile` 已预留 `tasteLabel` / `tasteLevel` 参数 |
| 4 | **真实菜单依赖门店营业时段** | 门店打烊时 `query-meals` 返回 `600057`，自动降级为演示数据（见第九节） |
| 5 | **`calculate-price` 尚未端到端验证** | 依赖真实菜单编码，需营业时段内复测 |
| 6 | live 模式下菜单与券可能来自不同来源 | 菜单抛异常会降级，券返回空列表不算异常 |
| 7 | 本机无浏览器渲染验证 | 视觉与 PNG 导出需人工走查 |
