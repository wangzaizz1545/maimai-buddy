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

from backend.mcp.normalize import derive_axes, max_kcal_of
from backend.mcp.schemas import CartItem, Coupon, Meal, Nutrition, PriceQuote

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


def best_coupon(total: float, coupons: list[Coupon]) -> Coupon | None:
    """适用且优惠最大的券。规则与前端本地兜底保持一致。"""
    usable = [c for c in coupons if total >= c.threshold]
    return max(usable, key=lambda c: c.discount, default=None)


class MockProvider:
    """Mock 数据源。source 固定为 "mock"，前端据此显示演示数据徽标。"""

    source = "mock"

    def get_menu(self) -> list[Meal]:
        return list(load_meals())

    def get_promotions(self) -> list[Coupon]:
        return list(load_coupons())

    def get_nutrition(self) -> list[Nutrition]:
        return list(load_nutrition())

    def calculate_price(self, items: list[CartItem]) -> PriceQuote:
        """本地算价。

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
