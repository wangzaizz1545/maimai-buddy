# MCP 配置与排错指南

> 本文是**操作手册**：怎么配 Token、怎么启动、怎么验证、出问题怎么查。
> 架构设计、工具清单与降级机制见 [`../MCP_INTEGRATION.md`](../MCP_INTEGRATION.md)。

---

## 一、申请 Token

1. 打开 <https://open.mcd.cn/mcp>
2. 点击右上角【登录】，用手机号完成验证
3. 登录后按钮变为【控制台】，点击打开控制台弹窗
4. 点击【激活】，阅读并同意《麦当劳 MCP 服务规则》
5. 申请成功后点击【一键复制】拿到 Token

> Token 有效性与额度由麦当劳侧控制，本项目不做缓存或续期。

---

## 二、配置 Token

### 🔒 安全规则（必须遵守）

| 规则 | 说明 |
|---|---|
| 只写进**项目根目录的 `.env`** | 该文件已被 `.gitignore` 排除 |
| 不要写进 `backend/.env.example` 或其他提交文件 | 那些文件会进仓库 |
| 不要贴到聊天、issue、截图、提交记录 | — |
| 不要放进任何代码文件 | 程序只从环境变量读取 |

程序会把 `your_token_here` 这类占位值识别为「未配置」，不会拿假 Token 去请求真实服务。

### 操作步骤

```bash
# 1. 在项目根目录创建 .env（若已存在则跳过）
cp .env.example .env          # Windows: copy .env.example .env

# 2. 编辑 .env，找到 MCD_MCP_TOKEN 那一行，把 Token 粘在等号后面
MCD_MCP_TOKEN=你复制的Token

# 3. 确保数据源开关是 live
MCBUDDY_MCP=live
```

> ⚠️ 注意：应用**只读项目根目录的 `.env`**，不会读 `backend/.env`。
> `backend/.env.example` 只是同一份配置的说明副本。

改完 **必须重启后端**才会生效。

---

## 三、环境变量说明

| 变量 | 取值 | 默认 | 说明 |
|---|---|---|---|
| `MCD_MCP_TOKEN` | 字符串 | 空 | 麦当劳 MCP Token。留空即使用演示数据 |
| `MCBUDDY_MCP` | `fixture` \| `live` | `fixture` | `fixture` 用本地演示数据；`live` 调真实 MCP |
| `MCP_BASE_URL` | URL | `https://mcp.mcd.cn` | MCP 服务地址，通常无需修改 |

读取逻辑集中在 `backend/mcp/config.py` 的 `get_mcp_token()` / `get_mcp_mode()` / `get_mcp_base_url()`。
非法模式值会安全回落到 `fixture`。

### 三种组合的实际行为

| `MCBUDDY_MCP` | `MCD_MCP_TOKEN` | 行为 |
|---|---|---|
| `fixture` | 任意 | 直接使用本地演示数据 |
| `live` | 已配置 | 调真实 MCP；失败时自动降级 |
| `live` | 未配置 | 自动降级到演示数据，**不报错、不崩溃** |

---

## 四、启动后端

```bash
# 项目根目录
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000   # Windows
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000           # macOS / Linux
```

或者直接双击 `start.bat`（会自动建环境、装依赖、起服务、开浏览器，且不会覆盖已有的 `.env`）。

| 地址 | 说明 |
|---|---|
| <http://127.0.0.1:8000> | 应用首页 |
| <http://127.0.0.1:8000/api> | 运行模式（含 `mcp` 字段） |
| <http://127.0.0.1:8000/docs> | 接口文档（FastAPI 自动生成） |

---

## 五、验证 MCP

### 一键验证（推荐）

```bash
.venv/Scripts/python.exe backend/verify_mcp.py     # Windows
.venv/bin/python backend/verify_mcp.py             # macOS / Linux
```

脚本第 6 节会在检测到有效 Token 时执行**真实调用**，并逐项报告：

```
=== 6. 真实连通性冒烟测试 ===
  检测到 Token，开始真实调用 …

  [无需门店]
  [OK] list-nutrition-foods  160 条

  [门店解析]
  [OK] query-nearby-stores  storeCode=1450713 orderType=1 beType=1

  [依赖门店]
  [OK] query-store-coupons  0 张（空列表也是正确结果）
  [--] query-meals  业务限制（非代码问题）：门店可能已关闭或不在营业时间（code=600057）
```

**判断标准**：出现 `[OK]` 说明该工具真实通了；`[--]` 是业务条件限制（如门店打烊），不算失败。

### 手动验证

```bash
curl http://127.0.0.1:8000/api/recommend/menu
```

看响应里的 `source` 字段（见第七节）。

---

## 六、错误码排查

### 401 — Token 无效、已过期或未提供

```
McpAuthError: MCP Token 无效、已过期或未提供（401）
```

| 排查项 | 处理 |
|---|---|
| `.env` 是否保存成功 | 重开文件确认值已写入、无首尾空格 |
| 值是否为占位符 | `your_token_here` 会被识别为未配置 |
| Token 是否过期 | 回 <https://open.mcd.cn/mcp> 控制台重新复制 |
| 是否粘贴了多余字符 | 不要加引号，`MCD_MCP_TOKEN=abc` 而非 `="abc"` |

程序行为：抛 `McpAuthError` → 降级到演示数据 → `source` 标记为 `mock`。

---

### 429 — 触发限流

```
McpRateLimitError: 触发 MCP 限流，超过 600 次/分钟（429）
```

麦当劳 MCP 限制 **600 次/分钟**。

| 排查项 | 处理 |
|---|---|
| 是否在压测 / 循环调用 | 降低调用频率 |
| 是否多个进程共用同一 Token | 合并为一个服务实例 |

**本项目已内置防护**：门店、菜单、券、营养四类结果各缓存 **600 秒**，
正常使用下不会触及上限。缓存实现在 `backend/mcp/live_provider.py` 的 `_cached()`。

---

### 600057 — 门店已关闭或不在营业时间

```
McpBusinessError: [query-meals] 门店可能已关闭或不在营业时间（code=600057）
```

**这是最常见的业务限制，不是代码缺陷。**

| 排查项 | 处理 |
|---|---|
| 当前时间 | 多数门店非 24 小时营业；凌晨、深夜常打烊 |
| 门店营业时段 | 从 `query-nearby-stores` 的 `reservationTimeOptions` 可查看当日场次 |
| 换一个场景 | 外送（`orderType=2`）或得来速（`beType=5`）的营业时间可能不同 |

程序行为：抛 `McpBusinessError` → 降级到演示数据 → 页面照常可用、`source` 标记为 `mock`。

> **想在演示时看到实时数据，请在门店营业时段运行**（通常早餐 05:00 后、午餐 10:30 后）。

---

### 600010 — 商品参数不正确

```
McpBusinessError: [calculate-price] 缺少商品code或者商品数量quantity不正确（code=600010）
```

`calculate-price` 的商品字段是 **`productCode` + `quantity`**，不是 `code` + `qty`：

```json
{
  "storeCode": "1450713",
  "orderType": 1,
  "beType": 1,
  "items": [{ "productCode": "SP001", "quantity": 1 }]
}
```

字段定义取自 `tools/list` 返回的 `inputSchema`。若将来服务端调整字段名，
只需修改 `backend/mcp/live_provider.py` 的 `calculate_price()`。

---

### 600048 — 外送场景缺少 beCode

```
McpBusinessError: 外送场景下，beType=2/5/6时必传beCode（code=600048）
```

`beType` 为 2（麦乐送）/ 5（得来速）/ 6（企业团餐）时，必须同时传 `beCode`，
该值从 `query-nearby-stores` 或 `delivery-query-stores` 的返回中获取。

**本项目使用到店自取**（`orderType=1, beType=1`），不需要 `beCode`。
若将来要支持外送，需在 `_resolve_store()` 中一并解析 `beCode`。

---

### 其他错误

| 现象 | 可能原因 | 处理 |
|---|---|---|
| `McpError: MCP 请求超时` | 网络不通 / 服务端缓慢 | 检查能否访问 `https://mcp.mcd.cn` |
| `McpError: MCP 网络错误` | DNS / 代理 / 防火墙 | 确认网络环境 |
| `McpProtocolError: 未找到可用门店` | 账号没有收藏门店 | 在麦当劳 App 收藏一家门店 |
| `McpProtocolError: 未返回可用记录` | 返回结构与预期不符 | 参照 `backend/mcp/verify_mcp.py` 打印原始结构，在 `normalize.py` 补字段候选名 |

---

## 七、`source` 判断：数据是实时的还是降级的

接口响应里的 `source` 字段是**唯一权威判据**：

| `source` | 含义 | 页面显示 |
|---|---|---|
| `"mcp"` | **实时数据** —— 来自麦当劳 MCP | 🟢 实时数据 |
| `"mock"` | **降级数据** —— 使用本地演示数据 | 🟡 演示数据 |

### 怎么查

```bash
curl http://127.0.0.1:8000/api/recommend/menu
```

```json
{
  "meals": [ ... ],
  "source": "mock",
  "fetchedAt": "2026-10-13T01:43:50+00:00"
}
```

页面上则显示为「麦友今日推荐」顶部的徽标。

### 两种降级要区分开

| 情况 | `degraded` | 页面徽标 |
|---|---|---|
| 后端不可用（前端降级） | `true` | 🟡 演示数据 · **后端未连接** |
| 后端可用，但其内部降级（门店打烊等） | `false` | 🟡 演示数据 |

第二种情况表示**服务是好的，只是真实数据暂时取不到**——两者是不同的失败层级。

> **硬性原则**：降级时绝不会把演示数据谎报成实时数据。
> 该保证在代码（`adapter._call`）、接口（`source` 字段）与界面（徽标）三处同时落实。

---

## 八、安全边界

### 已接入的工具（全部只读）

`query-nearby-stores` · `query-meals` · `list-nutrition-foods` ·
`query-store-coupons` · `calculate-price` · `now-time-info` ·
`campaign-calendar` · `available-coupons`

### 🚫 明确不接入

| 工具 | 原因 |
|---|---|
| `create-order` / `cancel-order` | 产生真实订单 |
| `auto-bind-coupons` | 真实领取优惠券 |
| `draw-lottery` | 消耗用户积分 |
| `mall-create-order` | 扣减积分与库存 |
| `party-order-create` | 产生真实预约 |
| `delivery-create-address` | 写入用户地址 |
| **`delivery-query-addresses`** | **返回收件人姓名、手机号、详细住址** |

最后一项在调试阶段被实测确认会返回真实个人数据，因此整条路径都不接通。

### Token 的流转范围

```
环境变量 → backend/mcp/config.py → Authorization 请求头
                                    ↑
                            到此为止，不再往前
```

Token 不写日志、不进异常消息、不进 API 响应、不进前端产物。
已用正则扫描全仓库确认无硬编码凭证。

---

## 九、复现步骤（完整流程）

```bash
# 1. 配置
cp .env.example .env                                  # Windows: copy .env.example .env
#    编辑 .env：填入 MCD_MCP_TOKEN，设 MCBUDDY_MCP=live

# 2. 验通
.venv/Scripts/python.exe backend/verify_mcp.py

# 3. 启动
.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 4. 确认数据来源
curl http://127.0.0.1:8000/api/recommend/menu
#    "source": "mcp"  → 实时数据
#    "source": "mock" → 已降级（门店可能打烊）

# 5. 打开页面看徽标
#    http://127.0.0.1:8000/recommend/
```
