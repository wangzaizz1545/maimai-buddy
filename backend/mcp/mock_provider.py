"""Mock Provider —— 读取 `fixtures/` 的演示数据。

用途有两层：
  1. `MCBUDDY_MCP=fixture` 时作为正式数据源
  2. 真实 MCP 不可用时的降级路径

与 Live Provider 的差别只在于**数据从哪来**：两者实现同一套 Provider 协议，
调用方（adapter / FastAPI）完全不感知差异。
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.mcp.normalize import derive_axes, max_kcal_of, to_store
from backend.mcp.schemas import CartItem, Coupon, Meal, Nutrition, PriceQuote, Store

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "fixtures"


def _load(name: str) -> dict[str, Any]:
    """读取 fixtures 下的 JSON。失败时返回空结构，绝不抛异常打断服务。"""
    path = FIXTURES_DIR / name
    try:
        with path.open(encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}


# ---------------------------------------------------------------------------
# 数据加载（进程内缓存）
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def load_meals() -> tuple[Meal, ...]:
    """菜单。fixtures 在进程生命周期内只读一次。"""
    data = _load("meals.json")
    items: list[dict[str, Any]] = data.get("items") or []
    if not items:
        return ()

    max_kcal = max_kcal_of(items)

    meals: list[Meal] = []
    for raw in items:
        axes = derive_axes(raw, max_kcal)
        meals.append(
            Meal(
                code=str(raw.get("code", "")),
                name=str(raw.get("name", "")),
                price=float(raw.get("price") or 0),
                kcal=int(raw.get("kcal") or 0),
                category=str(raw.get("category", "")),
                tags=list(raw.get("tags") or []),
                # fixtures 显式标注优先，缺失时用推导值
                spice=float(raw.get("spice", axes["spice"])),
                sweet=float(raw.get("sweet", axes["sweet"])),
                caffeine=float(raw.get("caffeine", axes["caffeine"])),
                filling=float(raw.get("filling", axes["filling"])),
                shareable=float(raw.get("shareable", axes["shareable"])),
            )
        )

    return tuple(meals)


@lru_cache(maxsize=1)
def load_coupons() -> tuple[Coupon, ...]:
    """优惠券。

    只取「满减」类券：单品券需要商品级规则，本项目尚未建模，
    纳入会导致 Mock 与前端本地兜底的行为不一致。
    """
    data = _load("coupons.json")
    items: list[dict[str, Any]] = data.get("items") or []

    return tuple(
        Coupon(
            id=str(raw.get("couponId") or raw.get("id") or ""),
            name=str(raw.get("name", "")),
            threshold=float(raw.get("threshold") or 0),
            discount=float(raw.get("discount") or 0),
        )
        for raw in items
        if (raw.get("type") or "") == "满减"
    )


@lru_cache(maxsize=1)
def load_nutrition() -> tuple[Nutrition, ...]:
    """营养数据。"""
    data = _load("nutrition.json")
    items: list[dict[str, Any]] = data.get("items") or []

    return tuple(
        Nutrition(
            code=str(raw.get("code", "")),
            energy_kcal=float(raw.get("energy_kcal") or 0),
            protein_g=float(raw.get("protein_g") or 0),
            fat_g=float(raw.get("fat_g") or 0),
            carbohydrate_g=float(raw.get("carbohydrate_g") or 0),
            sodium_mg=float(raw.get("sodium_mg") or 0),
        )
        for raw in items
    )


@lru_cache(maxsize=1)
def load_stores() -> tuple[Store, ...]:
    """门店演示数据。

    ⚠️ 这些不是真实门店：storeCode 使用 DEMO 前缀，名称带「（演示）」标识。
    真实门店由 `live_provider.search_stores()` 调 MCP 获取。
    """
    data = _load("stores.json")
    items: list[dict[str, Any]] = data.get("items") or []
    return tuple(to_store(raw) for raw in items)


def best_coupon(total: float, coupons: list[Coupon]) -> Coupon | None:
    """适用且优惠最大的券。规则与前端本地兜底保持一致。"""
    usable = [c for c in coupons if total >= c.threshold]
    return max(usable, key=lambda c: c.discount, default=None)


class MockProvider:
    """Mock 数据源。source 固定为 "mock"，前端据此显示演示数据徽标。"""

    source = "mock"

    def get_menu(self, store_code: str | None = None) -> list[Meal]:
        """菜单。

        `store_code` 被**刻意忽略**：演示数据只有一份菜单，没有门店维度。
        保留该参数是为了与 Live Provider 的协议一致——否则真实模式降级时
        会因签名不匹配而抛 TypeError。
        """
        return list(load_meals())

    def get_promotions(self, store_code: str | None = None) -> list[Coupon]:
        """优惠券。同样忽略 `store_code`（演示数据无门店维度）。"""
        return list(load_coupons())

    def get_nutrition(self) -> list[Nutrition]:
        return list(load_nutrition())

    def search_stores(self, city: str = "", keyword: str = "") -> list[Store]:
        """门店搜索（演示版）。

        真实 MCP 把 city 与 keyword 当作两个**独立的必填参数**；
        演示数据没有真实门店，因此这里做等价语义的过滤：

        - 两者都为空 → 全部门店（对应真实模式的「收藏门店」）
        - 都提供 → `city` 精确匹配 + `keyword` 在门店名/地址中做子串匹配
        - 只提供一个 → 只按该条件过滤

        与真实接口的差别：真实接口在只给一个参数时**报错**，
        演示数据则尽量给出结果——因为演示的目标是让页面可用，
        而真实模式的目标是如实反映服务端约束。

        过滤结果为空时**返回全部**，避免演示时出现空列表让人以为坏了。
        """
        items: list[dict[str, Any]] = (_load("stores.json").get("items")) or []
        if not city and not keyword:
            return [to_store(raw) for raw in items]

        def match(raw: dict[str, Any]) -> bool:
            if city and str(raw.get("city") or "") != city:
                return False
            if keyword:
                haystack = f"{raw.get('storeName', '')}{raw.get('address', '')}"
                if keyword not in haystack:
                    return False
            return True

        hits = [raw for raw in items if match(raw)]
        return [to_store(raw) for raw in (hits or items)]

    def calculate_price(
        self, items: list[CartItem], store_code: str | None = None
    ) -> PriceQuote:
        """本地算价。同样忽略 `store_code`。

        真实 MCP 下这一步由 `calculate-price` 提供，
        但 Mock 路径必须能独立完成算价，否则离线时页面不可用。
        """
        meals = {m.code: m for m in self.get_menu()}
        coupons = self.get_promotions()

        original = sum(
            meals[item.code].price * item.qty for item in items if item.code in meals
        )
        coupon = best_coupon(original, coupons)
        saved = coupon.discount if coupon else 0.0

        return PriceQuote(
            original=round(original, 2),
            coupon=coupon,
            payable=round(max(0.0, original - saved), 2),
            saved=round(saved, 2),
            source="mock",
        )
