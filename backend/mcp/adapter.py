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
import threading
from contextvars import ContextVar
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
    Store,
)

logger = logging.getLogger("mcbuddy.mcp")


class Provider(Protocol):
    """数据源协议。Mock 与 Live 都实现它。"""

    source: str

    def get_menu(self, store_code: str | None = None) -> list[Meal]: ...
    def get_promotions(self, store_code: str | None = None) -> list[Coupon]: ...
    def get_nutrition(self) -> list[Nutrition]: ...
    def search_stores(self, city: str = "", keyword: str = "") -> list[Store]: ...
    def calculate_price(
        self, items: list[CartItem], store_code: str | None = None
    ) -> PriceQuote: ...


# Provider 实例缓存：Live 需要复用 HTTP 会话与结果缓存，
# 每次请求都新建实例会导致反复握手并放大触发限流的风险。
# 用锁保护初始化，避免多个线程同时判空各自创建实例（check-then-act 竞态）。
_providers: dict[str, Provider] = {}
_providers_lock = threading.Lock()

# 最近一次实际生效的数据来源。
#
# 用 ContextVar 而非全局变量：FastAPI 同步端点跑在线程池里，
# 若用全局变量，请求 A 的 source 可能被并发请求 B 覆盖，
# 违背「如实标注数据来源」的核心设计。ContextVar 按请求上下文隔离。
_last_source: ContextVar[DataSource] = ContextVar("last_source", default="mock")


def _get_or_create(key: str, factory) -> Provider:
    """双重检查锁：先无锁快路径，未命中再加锁创建。"""
    provider = _providers.get(key)
    if provider is not None:
        return provider
    with _providers_lock:
        provider = _providers.get(key)
        if provider is None:
            provider = factory()
            _providers[key] = provider
        return provider


def get_provider() -> Provider:
    """按配置返回 Provider（带实例缓存）。"""
    if mcp_config.get_mcp_mode() == "live":
        provider = _get_or_create("live", LiveProvider)
        if not hasattr(provider, "_logged"):
            provider._logged = True  # type: ignore[attr-defined]
            logger.info("MCP 模式：live（%s）", mcp_config.describe())
        return provider

    return _get_or_create("mock", MockProvider)


def _mock() -> MockProvider:
    return _get_or_create("mock", MockProvider)  # type: ignore[return-value]


def _call(method: str, *args: Any, **kwargs: Any) -> Any:
    """调用当前 Provider；失败时降级到 Mock。

    降级后当前请求上下文的 `_last_source` 会被置为 "mock"，
    因此 API 层永远不会把演示数据谎报成实时数据。
    """
    provider = get_provider()
    try:
        result = getattr(provider, method)(*args, **kwargs)
        _last_source.set("mcp" if provider.source == "mcp" else "mock")
        return result
    except McpError as exc:
        # 异常消息由 live_provider 保证不含 Token
        logger.warning("MCP 调用失败，降级到演示数据：%s", exc)
    except Exception as exc:  # noqa: BLE001 - 任何异常都不应打断页面
        logger.warning("MCP 调用异常，降级到演示数据：%s", type(exc).__name__)

    _last_source.set("mock")
    return getattr(_mock(), method)(*args, **kwargs)


# ---------------------------------------------------------------------------
# 取数接口（供 FastAPI 调用）
# ---------------------------------------------------------------------------
def get_menu(store_code: str | None = None) -> list[Meal]:
    """对应 MCP `query-meals`。

    `store_code` 由用户在 /store 页选择后传入；为 None 时由 Live Provider
    回退到收藏门店。
    """
    return _call("get_menu", store_code)


def get_promotions(store_code: str | None = None) -> list[Coupon]:
    """对应 MCP `query-store-coupons`。"""
    return _call("get_promotions", store_code)


def get_nutrition() -> list[Nutrition]:
    """对应 MCP `list-nutrition-foods`。

    当前前端未直接调用此接口，但 Provider 协议保留它，
    避免将来要用营养数据时再改一次协议。
    """
    return _call("get_nutrition")


def search_stores(city: str = "", keyword: str = "") -> list[Store]:
    """对应 MCP `query-nearby-stores`。

    真实模式下 city 与 keyword 需同时提供（见 live_provider.search_stores），
    否则回退到收藏门店。Mock 模式为自由文本过滤。
    """
    return _call("search_stores", city, keyword)


def calculate(
    items: list[CartItem], store_code: str | None = None
) -> PriceQuote:
    """对应 MCP `calculate-price` —— 权威价格来源。"""
    return _call("calculate_price", items, store_code)


def current_source() -> DataSource:
    """本次实际生效的数据来源（降级后为 "mock"）。"""
    return _last_source.get()


def now_iso() -> str:
    """统一的取数时间戳。"""
    return datetime.now(timezone.utc).isoformat()
