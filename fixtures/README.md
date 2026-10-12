# fixtures —— 演示数据（降级兜底）

本目录是 **Mock Provider 的数据源**，在真实 MCP 不可用时作为降级路径，
保证页面在任何情况下都不会白屏。

## 当前角色

```
MCBUDDY_MCP=live + 门店营业中  →  backend/mcp/live_provider.py  →  真实麦当劳 MCP
MCBUDDY_MCP=live + 门店打烊    →  降级  ─┐
MCBUDDY_MCP=fixture           →  直接使用 ├→  本目录
未配置 Token                   →  直接使用 ─┘
```

**降级时接口的 `source` 字段会如实标记为 `"mock"`**，前端显示「演示数据」徽标——
不会把这里的数据谎报成实时数据。

## 数据性质

文件内容是**人工构造的演示数据**，不是真实抓取的快照。
每个 JSON 的 `_source` 字段标记为 `placeholder`，`_note` 说明了这一点。

| 文件 | 对应 MCP 工具 | 说明 |
|---|---|---|
| `meals.json` | `query-meals` | 门店可售菜单（12 项） |
| `coupons.json` | `query-store-coupons` | 可用优惠券（仅取「满减」类） |
| `nutrition.json` | `list-nutrition-foods` | 餐品营养数据 |
| `campaign.json` | `campaign-calendar` | 当月营销活动 |

### 关于 `meals.json` 的五个匹配轴

真实 MCP 只返回标签与营养数据，**不返回** `spice` / `sweet` / `caffeine` /
`filling` / `shareable`。本目录显式标注这五个轴，是为了让 Mock 与 Live
两条路径的推荐行为一致。

当某条记录**缺少**这些字段时，`backend/mcp/normalize.py` 的 `derive_axes()`
会从标签与热量推导补齐——这正是真实 MCP 数据走的路径。

## 若要把真实响应存为快照

必须脱敏后再入库：

- ❌ 不得包含 Token、密钥
- ❌ 不得包含手机号、配送地址、订单号
- ❌ 不得包含任何个人信息
- ❌ **绝不要保存 `delivery-query-addresses` 的返回**（实测含收件人姓名与住址）

当前无需采集快照——真实数据由 `live_provider.py` 实时获取，
本目录仅作为演示与降级用途。
