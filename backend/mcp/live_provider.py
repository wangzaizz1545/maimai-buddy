"""Live Provider —— 真实麦当劳 MCP 接入。

传输：Streamable HTTP（JSON-RPC 2.0），接入地址 `https://mcp.mcd.cn`。
鉴权：请求头 `Authorization: Bearer <MCD_MCP_TOKEN>`。

## 安全约束（强制）

- Token **只**从 `backend/mcp/config.py` 的 `get_mcp_token()` 读取
- Token 不写日志、不进异常消息、不出现在任何返回值里

## 🚫 禁用工具

以下工具**永远不接入**。前七个有真实副作用；最后一个会返回**个人隐私数据**：

| 工具 | 原因 |
|---|---|
| `create-order` / `cancel-order` | 产生真实订单 |
| `auto-bind-coupons` | 真实领取优惠券 |
| `draw-lottery` | 消耗用户积分 |
| `mall-create-order` | 扣减积分与库存 |
| `party-order-create` | 产生真实预约 |
| `delivery-create-address` | 写入用户地址 |
| **`delivery-query-addresses`** | **返回收件人姓名、手机号、详细住址** |

最后一项是实测发现的：该工具会返回真实收货人姓名与家庭地址。
一旦这些数据进入日志或 API 响应就是隐私事故，因此整条路径都不接通。

## 只读工具与调用链（已用真实 Token 验证）

`query-meals` / `query-store-coupons` / `calculate-price` 都**必须传 storeCode**，
因此真实调用链是「先解析门店，再查数据」：

    query-nearby-stores { beType:1, searchType:1 }   → 收藏门店
            ↓ storeCode
    query-meals { storeCode, orderType:1, beType:1 }
    query-store-coupons { storeCode, orderType:1, beType:1 }
    calculate-price { storeCode, orderType:1, beType:1, items }

无门店参数的只读工具：`list-nutrition-foods`（表格文本）、
`now-time-info`、`available-coupons`、`campaign-calendar`。
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from backend.mcp import config
from backend.mcp.errors import (
    McpAuthError,
    McpBusinessError,
    McpError,
    McpProtocolError,
    McpRateLimitError,
)
from backend.mcp.normalize import (
    ensure_success,
    extract_payload,
    find_items,
    max_kcal_of,
    parse_table,
    to_coupon,
    to_meal,
    to_nutrition,
    to_store,
)
from backend.mcp.schemas import CartItem, Coupon, Meal, Nutrition, PriceQuote, Store

logger = logging.getLogger("mcbuddy.mcp.live")

# 便于调用方从一个地方导入异常
__all__ = [
    "LiveProvider",
    "McpError",
    "McpAuthError",
    "McpRateLimitError",
    "McpProtocolError",
    "McpBusinessError",
]

PROTOCOL_VERSION = "2025-06-18"
CLIENT_NAME = "mcbuddy-ai"
CLIENT_VERSION = "0.2.0"

REQUEST_TIMEOUT = 10.0

# 结果缓存：避免触及 600 次/分钟的限流上限
CACHE_TTL_SECONDS = 600

# 到店自取：orderType=1（到店），beType=1（到店取餐）
DEFAULT_ORDER_TYPE = 1
DEFAULT_BE_TYPE = 1


# ---------------------------------------------------------------------------
# 传输层
# ---------------------------------------------------------------------------
def _parse_sse(text: str) -> Any:
    """从 text/event-stream 响应中取出最后一个可解析的 JSON。"""
    chunks: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("data:"):
            payload = line[5:].strip()
            if payload and payload != "[DONE]":
                chunks.append(payload)

    for chunk in reversed(chunks):
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            continue

    raise McpProtocolError("SSE 响应中未找到可解析的 JSON")


class McpHttpClient:
    """最小化的 MCP Streamable HTTP 客户端。"""

    def __init__(self, base_url: str, token: str) -> None:
        self._base_url = base_url
        self._session_id: str | None = None
        self._initialized = False
        self._client = httpx.Client(
            timeout=REQUEST_TIMEOUT,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                # Token 只在这一处使用，不写入任何日志
                "Authorization": f"Bearer {token}",
            },
        )

    def _headers(self) -> dict[str, str]:
        return {"Mcp-Session-Id": self._session_id} if self._session_id else {}

    def _post(self, payload: dict[str, Any]) -> Any:
        try:
            response = self._client.post(
                self._base_url, json=payload, headers=self._headers()
            )
        except httpx.TimeoutException as exc:
            raise McpError("MCP 请求超时") from exc
        except httpx.HTTPError as exc:
            raise McpError(f"MCP 网络错误：{type(exc).__name__}") from exc

        if response.status_code == 401:
            raise McpAuthError("MCP Token 无效、已过期或未提供（401）")
        if response.status_code == 429:
            raise McpRateLimitError("触发 MCP 限流，超过 600 次/分钟（429）")
        if response.status_code >= 400:
            raise McpError(f"MCP 返回错误状态 {response.status_code}")

        session_id = response.headers.get("Mcp-Session-Id")
        if session_id:
            self._session_id = session_id

        content_type = response.headers.get("Content-Type", "")
        if "text/event-stream" in content_type:
            return _parse_sse(response.text)
        return response.json()

    @staticmethod
    def _raise_on_error(data: Any) -> None:
        if isinstance(data, dict) and "error" in data:
            error = data["error"]
            code = error.get("code") if isinstance(error, dict) else None
            message = error.get("message") if isinstance(error, dict) else str(error)
            if code == -32001:
                raise McpRateLimitError(f"MCP 限流：{message}")
            raise McpError(f"MCP 返回错误：{message}")

    def initialize(self) -> None:
        """完成 MCP 握手。同一实例只做一次。"""
        if self._initialized:
            return

        result = self._post(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": CLIENT_NAME, "version": CLIENT_VERSION},
                },
            }
        )
        self._raise_on_error(result)

        try:
            self._client.post(
                self._base_url,
                json={"jsonrpc": "2.0", "method": "notifications/initialized"},
                headers=self._headers(),
            )
        except httpx.HTTPError:
            logger.debug("notifications/initialized 发送失败，继续")

        self._initialized = True

    def call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """调用一个 MCP 工具并返回**解包前**的原始信封。

        返回原始信封而非直接解包，是为了让 `ensure_success` 能读到
        `structuredContent.success` 做业务层校验。
        """
        self.initialize()

        response = self._post(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {"name": name, "arguments": arguments},
            }
        )
        self._raise_on_error(response)

        result = response.get("result", response) if isinstance(response, dict) else response

        if isinstance(result, dict) and result.get("isError"):
            raise McpProtocolError(f"工具 {name} 返回 isError 标记")

        return extract_payload(result)

    def close(self) -> None:
        self._client.close()


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------
class LiveProvider:
    """真实 MCP 数据源。

    任何失败都会抛出 `McpError` 的子类，由 `adapter.py` 捕获并降级到 Mock——
    **不会**在失败时返回貌似真实的数据。
    """

    source = "mcp"

    def __init__(self) -> None:
        self._client: McpHttpClient | None = None
        self._cache: dict[str, tuple[float, Any]] = {}
        self._store: tuple[str, int, int] | None = None

    # -- 内部 ---------------------------------------------------------------
    def _get_client(self) -> McpHttpClient:
        token = config.get_mcp_token()
        if not token:
            raise McpAuthError(
                "未配置 MCD_MCP_TOKEN，无法调用真实 MCP。"
                "申请地址 https://open.mcd.cn/mcp"
            )
        if self._client is None:
            self._client = McpHttpClient(config.get_mcp_base_url(), token)
        return self._client

    def _call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """调用工具并做业务层校验（success=false 会抛 McpBusinessError）。"""
        payload = self._get_client().call_tool(name, arguments)
        return ensure_success(payload, name)

    def _cached(self, key: str, factory):
        """带 TTL 的缓存，降低调用频率。仅在成功时写入。"""
        now = time.monotonic()
        hit = self._cache.get(key)
        if hit and now - hit[0] < CACHE_TTL_SECONDS:
            return hit[1]

        value = factory()
        self._cache[key] = (now, value)
        return value

    def _resolve_store(self, store_code: str | None = None) -> tuple[str, int, int]:
        """解析门店，返回 (storeCode, orderType, beType)。

        三种情况：
          1. 调用方显式传入 storeCode（用户在 /store 页选了门店）→ 直接使用
          2. 之前解析过 → 用缓存
          3. 都没有 → 回退到收藏门店（query-nearby-stores searchType=1）
        """
        if store_code:
            return (str(store_code), DEFAULT_ORDER_TYPE, DEFAULT_BE_TYPE)

        if self._store is not None:
            return self._store

        payload = self._call_tool(
            "query-nearby-stores",
            {"beType": DEFAULT_BE_TYPE, "searchType": 1},  # searchType=1 收藏餐厅
        )
        records = find_items(payload)
        if not records:
            raise McpProtocolError("未找到可用门店（收藏餐厅为空）")

        resolved = records[0].get("storeCode")
        if not resolved:
            raise McpProtocolError("门店记录缺少 storeCode")

        self._store = (str(resolved), DEFAULT_ORDER_TYPE, DEFAULT_BE_TYPE)
        logger.info("已解析门店：%s", self._store[0])
        return self._store

    # -- 门店搜索 -----------------------------------------------------------
    def search_stores(self, city: str = "", keyword: str = "") -> list[Store]:
        """对应 MCP `query-nearby-stores`。

        真实接口的两种模式（已实测）：

        | searchType | 必填参数 | 返回字段 |
        |---|---|---|
        | 1（收藏门店） | 无 | 无 `businessStatus` |
        | 2（城市搜索） | **city 与 keyword 都必须给** | 含 `businessStatus` / 营业时间 |

        只给其中一个会返回 `600058 城市名或者关键词不能为空`，
        因此这里要求两者同时提供，否则回退到收藏门店。
        """
        if city and keyword:
            args: dict[str, Any] = {
                "beType": DEFAULT_BE_TYPE,
                "searchType": 2,
                "city": city,
                "keyword": keyword,
            }
            cache_key = f"stores:{city}:{keyword}"
        else:
            args = {"beType": DEFAULT_BE_TYPE, "searchType": 1}
            cache_key = "stores:favorites"

        def factory() -> list[Store]:
            payload = self._call_tool("query-nearby-stores", args)
            return [to_store(raw) for raw in find_items(payload)]

        return self._cached(cache_key, factory)

    # -- Provider 协议 ------------------------------------------------------
    def get_menu(self, store_code: str | None = None) -> list[Meal]:
        """对应 MCP `query-meals`。"""

        def factory() -> list[Meal]:
            code, order_type, be_type = self._resolve_store(store_code)
            payload = self._call_tool(
                "query-meals",
                {"storeCode": code, "orderType": order_type, "beType": be_type},
            )
            records = find_items(payload)
            if not records:
                raise McpProtocolError("query-meals 未返回可用餐品")

            max_kcal = max_kcal_of(records)
            return [to_meal(raw, max_kcal) for raw in records]

        # 指定门店时不走缓存，避免把 A 店的菜单给到 B 店
        if store_code:
            return factory()
        return self._cached("menu", factory)

    def get_promotions(self, store_code: str | None = None) -> list[Coupon]:
        """对应 MCP `query-store-coupons`。

        **取不到就返回空列表**——真实模式下不使用演示券冒充真实券。
        前端会如实显示「暂无可用券」。
        """

        def factory() -> list[Coupon]:
            code, order_type, be_type = self._resolve_store(store_code)
            payload = self._call_tool(
                "query-store-coupons",
                {"storeCode": code, "orderType": order_type, "beType": be_type},
            )
            return [to_coupon(raw) for raw in find_items(payload)]

        if store_code:
            return factory()
        return self._cached("promotions", factory)

    def get_nutrition(self) -> list[Nutrition]:
        """对应 MCP `list-nutrition-foods`。

        真实返回是**紧凑表格文本**（非 JSON），需走 `parse_table`。
        """

        def factory() -> list[Nutrition]:
            payload = self._call_tool("list-nutrition-foods", {})

            data = payload.get("data") if isinstance(payload, dict) else payload
            if isinstance(data, str):
                records = parse_table(data)
            else:
                records = find_items(payload)

            return [to_nutrition(raw) for raw in records]

        return self._cached("nutrition", factory)

    def calculate_price(
        self, items: list[CartItem], store_code: str | None = None
    ) -> PriceQuote:
        """对应 MCP `calculate-price` —— 权威价格来源。

        返回结构若无法识别会抛 `McpProtocolError` 触发降级，
        而不是自行套用本地算法冒充真实价格。
        """
        code, order_type, be_type = self._resolve_store(store_code)

        payload = self._call_tool(
            "calculate-price",
            {
                "storeCode": code,
                "orderType": order_type,
                "beType": be_type,
                # 真实字段名（来自 tools/list 的 inputSchema）：
                #   productCode 商品编码、quantity 数量（必填，≥1）
                # 不是 code / qty —— 用错会返回 600010「缺少商品code或者商品数量不正确」
                "items": [
                    {"productCode": item.code, "quantity": item.qty} for item in items
                ],
            },
        )

        data = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(data, dict):
            raise McpProtocolError("calculate-price 返回结构无法识别")

        def num(*keys: str) -> float | None:
            for key in keys:
                value = data.get(key)
                if isinstance(value, (int, float)):
                    return float(value)
            return None

        original = num("original", "originalPrice", "subtotal", "totalPrice")
        payable = num("payable", "finalPrice", "total", "payAmount")
        saved = num("saved", "discount", "discountAmount")

        if original is None or payable is None:
            raise McpProtocolError("calculate-price 缺少金额字段")

        return PriceQuote(
            original=round(original, 2),
            coupon=None,
            payable=round(payable, 2),
            saved=round(
                saved if saved is not None else max(0.0, original - payable), 2
            ),
            source="mcp",
        )
