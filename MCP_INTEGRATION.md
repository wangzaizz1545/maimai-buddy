# 麦当劳 MCP 接入说明

> **状态：已接入并通过真实调用验证。**
>
> 本文档说明 McBuddy AI 实际接入的麦当劳 MCP Server、使用的 Tool、
> 完整调用流程与降级机制。文中所有「已验证」结论均来自真实的 MCP 调用，
> 未经真实调用的部分会明确标注。

---

## 一、验证状态

| 环节 | 状态 | 实测结果 |
|---|---|---|
| JSON-RPC 握手 `initialize` | ✅ 已验证 | 成功 |
| 鉴权 `Authorization: Bearer` | ✅ 已验证 | Token 有效 |
| `tools/list` | ✅ 已验证 | 服务端提供 **35 个工具** |
| `list-nutrition-foods` | ✅ 已验证 | 返回 **160 条**营养数据 |
| `query-nearby-stores` | ✅ 已验证 | 返回真实门店（storeCode 如 `1450713`） |
| `available-coupons` | ✅ 已验证 | 返回 7 张可领券 |
| `campaign-calendar` | ✅ 已验证 | 返回真实活动日历 |
| `query-store-coupons` | ✅ 已验证 | 返回空列表（该门店当前无券，属合法结果） |
| `query-meals` | ⚠️ 条件性 | 需门店营业时段；打烊时返回 `600057` 并触发降级 |
| `calculate-price` | ⏸ 待验证 | 依赖真实菜单编码，需营业时段内复测 |

> `query-meals` / `query-store-coupons` / `calculate-price` 三者都**强制要求 `storeCode`**，
> 因此本项目的真实调用链是「先解析门店，再查数据」。

---

## 二、整体架构

```
浏览器  /recommend 页面
    │  仅发送人格向量与预算，不含任何凭证
    ▼
FastAPI   GET /api/recommend/menu · /promotions · POST /calculate
    │      （backend/api/recommend.py —— 只接参数、调 Adapter、返模型）
    ▼
MCP Adapter   backend/mcp/adapter.py
    │      Provider 选择 + 失败降级 + source 诚实标记
    │
    ├── MCBUDDY_MCP=fixture ──► MockProvider ──► fixtures/*.json
    │
    └── MCBUDDY_MCP=live ─────► LiveProvider
                                    │  Streamable HTTP + JSON-RPC 2.0
                                    │  Authorization: Bearer <MCD_MCP_TOKEN>
                                    ▼
                             https://mcp.mcd.cn   （麦当劳中国官方 MCP Server）
```

**分层职责**

| 层 | 文件 | 职责 | 明确不负责 |
|---|---|---|---|
| API | `backend/api/recommend.py` | 接参数、返模型 | ❌ 不含推荐逻辑 |
| Adapter | `backend/mcp/adapter.py` | 选 Provider、降级、标记来源 | ❌ 不依赖 FastAPI |
| Provider | `mock_provider.py` / `live_provider.py` | 取数、算价 | ❌ 不打分排序 |
| 归一化 | `backend/mcp/normalize.py` | 外部数据 → schema | — |
| 配置 | `backend/mcp/config.py` | 唯一读取 MCP 环境变量 | — |
| 推荐引擎 | `frontend/lib/recommend.ts` | 五轴打分、组合、选券 | ❌ 不接触 MCP |

---

## 三、接入的 MCP Server

| 项 | 值 |
|---|---|
| 提供方 | 麦当劳中国（McDonald's China） |
| 接入地址 | `https://mcp.mcd.cn` |
| 传输协议 | Streamable HTTP（JSON-RPC 2.0） |
| 协议版本 | `2025-06-18` |
| 鉴权 | 请求头 `Authorization: Bearer <MCD_MCP_TOKEN>` |
| 工具总数 | 35 |
| 频次限制 | 600 次 / 分钟（超出返回 429） |
| Token 申请 | <https://open.mcd.cn/mcp> |
| 官方文档 | <https://github.com/M-China/mcd-mcp-server> |

错误码处理：

| code | 含义 | 处理 |
|---|---|---|
| 401 | Token 无效 / 过期 / 未提供 | 抛 `McpAuthError` → 降级 |
| 429 | 超过 600 次/分钟 | 抛 `McpRateLimitError` → 降级 |
| 600057 | 门店已关闭或不在营业时间 | 抛 `McpBusinessError` → 降级 |
| 600010 | 商品参数不正确 | 抛 `McpBusinessError` → 降级 |

---

## 四、使用的 Tools

### 4.1 已接入（全部为只读）

| Tool | 用途 | 在项目中的角色 |
|---|---|---|
| `query-nearby-stores` | 查询门店 | **链路起点 + 用户可见**：`/store` 页按其结果渲染门店卡片 |
| `query-meals` | 门店可售餐品 | 菜单来源（硬约束） |
| `list-nutrition-foods` | 营养数据 | 热量与营养维度 |
| `query-store-coupons` | 门店可用券 | 优惠模拟数据源 |
| `calculate-price` | 价格计算 | **唯一权威价格来源** |
| `now-time-info` | 当前时间 | 时段判断 |
| `campaign-calendar` | 营销活动 | 备选：当期活动 |
| `available-coupons` | 可领券列表 | 备选：麦麦省领券 |

### 4.2 明确不接入

**⚠️ 前七个有真实副作用，最后一个会返回个人隐私数据。**

| Tool | 不接入原因 |
|---|---|
| `create-order` / `cancel-order` | 产生真实订单 |
| `auto-bind-coupons` | 真实领取优惠券 |
| `draw-lottery` | 消耗用户积分 |
| `mall-create-order` | 扣减积分与库存 |
| `party-order-create` | 产生真实预约 |
| `delivery-create-address` | 写入用户地址 |
| **`delivery-query-addresses`** | **返回收件人姓名、手机号、详细住址** |

最后一项在探测阶段被实测确认会返回真实个人数据（姓名 / 手机号 / 家庭住址）。
该工具已在代码层面列入禁用清单，**整条调用路径都不接通**，
避免个人数据流入日志、API 响应或前端。

---

## 五、调用流程

### 5.1 真实链路（先门店，后数据）

```
① query-nearby-stores
        │  searchType=1（收藏门店）或 searchType=2（城市 + 关键词）
        ▼
   storeCode（例如 1450724）        ← 用户在 /store 页选择
        │
        ├─② query-meals          { storeCode, orderType:1, beType:1 }
        ├─③ query-store-coupons  { storeCode, orderType:1, beType:1 }
        └─④ calculate-price      { storeCode, orderType:1, beType:1,
                                    items:[{ productCode, quantity }] }
```

参数含义：`orderType` 1=到店 / 2=外送；`beType` 1=到店取餐 / 2=麦乐送 / 5=得来速 / 6=企业团餐。
本项目使用 **到店自取**（`orderType=1, beType=1`）。

**门店搜索的两种模式（实测差异）**

| searchType | 必填参数 | 返回 `businessStatus` | 用途 |
|---|---|---|---|
| 1 | 无 | ❌ 不返回 | 收藏门店，作为默认值 |
| 2 | **city 与 keyword 都必须给** | ✅ 返回 | 用户主动搜索 |

只给其中一个参数会返回 `600058 城市名或者关键词不能为空`，
因此 `/api/store/search` 在收到这种请求时直接返回 400 并说明原因。

> 参数名踩坑记录：`calculate-price` 的商品字段是 **`productCode` + `quantity`**，
> 不是 `code` + `qty`。用错会返回 `600010`。字段定义取自 `tools/list` 的 `inputSchema`。
>
> 另一个实测发现：门店打烊时 `calculate-price` 也会拒绝，返回
> `60003 门店暂停营业，请重新选择门店`。所以「算价失败」不一定是我们传错了参数。

### 5.2 生命周期时序

```
页面请求 /api/recommend/menu
      │
      ▼
Adapter._call("get_menu")
      │
      ├─ LiveProvider.get_menu()
      │     ├─ _resolve_store()          ← 首次调用，之后走缓存
      │     ├─ tools/call query-meals
      │     ├─ ensure_success()          ← success=false 则抛业务异常
      │     └─ normalize.to_meal()       ← 字段名容错 + 分类映射 + 轴推导
      │
      └─ 任何异常 → 记录日志 → 改用 MockProvider → source 标记为 "mock"
```

---

## 六、降级（Fallback）机制

### 三层降级

| 层 | 位置 | 触发条件 | 结果 |
|---|---|---|---|
| L1 | 前端 Provider | 后端不可用 / 超时 4s | 改用前端本地 Mock |
| L2 | Adapter | Live 调用抛任何异常 | 改用后端 MockProvider |
| L3 | Provider | — | 门店打烊 / 无券等业务限制 |

### 关键设计：降级时 **source 必须如实标记**

- 成功走真实 MCP → `source = "mcp"`
- 任意降级 → `source = "mock"`

前端据此显示「实时数据 / 演示数据」徽标。**宁可显示演示数据，也绝不把 Mock 谎报成实时。**

实测验证：

```
MCBUDDY_MCP=live，但门店打烊：
  /api/recommend/menu → source = mock   meals = 12   ← 页面照常可用，未崩溃
  /api/recommend/promotions → coupons = 0            ← 不拿演示券冒充真实券
```

### 缓存策略

门店、菜单、券、营养四类结果各缓存 **600 秒**，避免触及 600 次/分钟的限流上限。

---

## 七、安全说明

### 7.1 Token 只存在于后端

| 要求 | 实现 |
|---|---|
| Token 唯一读取点 | `backend/mcp/config.py` 的 `get_mcp_token()` |
| Token 唯一使用点 | `Authorization` 请求头 |
| 不进日志 | 异常消息由 `errors.py` 统一构造，不含凭证 |
| 不进响应体 | 已实测：`/api/recommend/*` 响应中检索 `Bearer` / `token` / `secret` 均无命中 |
| 不进前端产物 | 前端只调用后端 API，从不接触 MCP |
| 不进仓库 | 真实 Token 只写在根目录 `.env`，已被 `.gitignore` 排除 |

### 7.2 仓库内无真实凭证

已用正则扫描全仓库（排除依赖与产物）：**未发现硬编码 Token**。
`mcp-config.example.json` 与两处 `.env.example` 均只使用 `${MCD_MCP_TOKEN}` 或占位值。

程序会把 `your_token_here` 这类占位值识别为「未配置」，避免用假 Token 误发请求。

### 7.3 只读原则

仅接入查询类工具；所有有副作用或涉及隐私的工具均已禁用（见 4.2）。

### 7.4 数据脱敏

若将来把真实响应存为 `fixtures/` 快照，必须移除：Token、手机号、配送地址、订单号、个人标识。

---

## 八、配置文件

[`mcp-config.example.json`](./mcp-config.example.json) 是脱敏的 MCP 客户端配置示例：

```json
{
  "mcpServers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://mcp.mcd.cn",
      "headers": { "Authorization": "Bearer ${MCD_MCP_TOKEN}" }
    }
  }
}
```

> 本项目自身不使用该 JSON 连接——`backend/mcp/live_provider.py` 以编程方式发起请求。
> 该文件用于向评审说明接入形态。

环境变量（写在**项目根目录的 `.env`**）：

```env
MCBUDDY_MCP=live                    # fixture = 演示数据 | live = 真实 MCP
MCD_MCP_TOKEN=<你的 Token>          # 切勿提交到仓库
MCP_BASE_URL=https://mcp.mcd.cn     # 通常无需修改
```

---

## 九、复现步骤

```bash
# 1. 配置 Token（在项目根目录）
cp .env.example .env          # Windows: copy .env.example .env
#    编辑 .env，填入 MCD_MCP_TOKEN，并将 MCBUDDY_MCP 设为 live

# 2. 一键验证（含真实连通性冒烟测试）
.venv/Scripts/python.exe backend/verify_mcp.py

# 3. 启动服务
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 4. 确认数据来源
curl http://127.0.0.1:8000/api/recommend/menu
#    "source": "mcp"  → 实时数据
#    "source": "mock" → 已降级（此时门店可能打烊）
```

`verify_mcp.py` 的第 6 节会在检测到有效 Token 时执行真实调用，
并区分「代码缺陷」与「业务限制」（如门店打烊），后者不算失败。

---

## 十、免责声明

本项目为「麦当劳程序员创意开发大赛」参赛作品，由参赛者独立开发，
**非麦当劳官方产品**。MCP 接入遵循麦当劳中国《使用条款》与《麦当劳 MCP 服务规则》。

在真实 MCP 不可用（门店打烊、网络异常等）时，项目会降级使用本地演示数据并在界面与
接口中如实标注；演示数据的价格与优惠**不构成任何真实点餐建议**。
餐品信息、价格及供应状态以麦当劳官方渠道的实时结果为准。
