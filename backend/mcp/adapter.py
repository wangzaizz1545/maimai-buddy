"""MCP Adapter —— 上层唯一的取数入口。

职责：
  1. 依据 `MCBUDDY_MCP`（`fixture` | `live`）选择 Provider
  2. 向 FastAPI 暴露三个取数函数与一个算价函数
  3. **在 Live Provider 不可用时自动降级到 Mock，并保持 source 诚实**

设计约束：
  - 本层不依赖 FastAPI，可被任意上层复用
  - **不把推荐逻辑写进 API 层**：打分与排序仍在前端 `lib/recommend.ts`
  - Token 只在 `mcp/config.py` 读取，本层只关心「有没有配」
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Protocol

from backend.mcp import config as mcp_config
from backend.mcp.errors import McpError
from backend.mcp.live_provider import LiveProvider
from backend.mcp.mock_provider import MockProvider
from backend.mcp.schemas import (
    CartItem,
    Coupon,
    DataSource,
    Meal,
    Nutrition,
    PriceQuote,
)

logger = logging.getLogger("mcbuddy.mcp")


class Provider(Protocol):
    """数据源协议。Mock 与 Live 都实现它。"""

    source: str

    def get_menu(self) -> list[Meal]: ...
    def get_promotions(self) -> list[Coupon]: ...
    def get_nutrition(self) -> list[Nutrition]: ...
    def calculate_price(self, items: list[CartItem]) -> PriceQuote: ...


# Provider 实例缓存：Live 需要复用 HTTP 会话与结果缓存，
# 每次请求都新建实例会导致反复握手并放大触发限流的风险。
_providers: dict[str, Provider] = {}

# 最近一次实际生效的数据来源。由 _call 更新，供 API 层如实标注。
_last_source: DataSource = "mock"


def get_provider() -> Provider:
    """按配置返回 Provider（带实例缓存）。"""
    if mcp_config.get_mcp_mode() == "live":
        if "live" not in _providers:
            _providers["live"] = LiveProvider()
            logger.info("MCP 模式：live（%s）", mcp_config.describe())
        return _providers["live"]

    if "mock" not in _providers:
        _providers["mock"] = MockProvider()
    return _providers["mock"]


def _mock() -> MockProvider:
    if "mock" not in _providers:
        _providers["mock"] = MockProvider()
    return _providers["mock"]  # type: ignore[return-value]


def _call(method: str, *args: Any) -> Any:
    """调用当前 Provider；失败时降级到 Mock。

    降级后 `_last_source` 会被置为 "mock"，
    因此 API 层永远不会把演示数据谎报成实时数据。
    """
    global _last_source

    provider = get_provider()
    try:
        result = getattr(provider, method)(*args)
        _last_source = "mcp" if provider.source == "mcp" else "mock"
        return result
    except McpError as exc:
        # 异常消息由 live_provider 保证不含 Token
        logger.warning("MCP 调用失败，降级到演示数据：%s", exc)
    except Exception as exc:  # noqa: BLE001 - 任何异常都不应打断页面
        logger.warning("MCP 调用异常，降级到演示数据：%s", type(exc).__name__)

    _last_source = "mock"
    return getattr(_mock(), method)(*args)


# ---------------------------------------------------------------------------
# 取数接口（供 FastAPI 调用）
# ---------------------------------------------------------------------------
def get_menu() -> list[Meal]:
    """对应 MCP `query-meals`。"""
    return _call("get_menu")


def get_promotions() -> list[Coupon]:
    """对应 MCP `query-store-coupons`。"""
    return _call("get_promotions")


def get_nutrition() -> list[Nutrition]:
    """对应 MCP `list-nutrition-foods`。

    当前前端未调用此接口，但 Provider 协议保留它，
    避免将来要用营养数据时再改一次协议。
    """
    return _call("get_nutrition")


def calculate(items: list[CartItem]) -> PriceQuote:
    """对应 MCP `calculate-price` —— 权威价格来源。"""
    return _call("calculate_price", items)


def current_source() -> DataSource:
    """本次实际生效的数据来源（降级后为 "mock"）。"""
    return _last_source


def now_iso() -> str:
    """统一的取数时间戳。"""
    return datetime.now(timezone.utc).isoformat()
