"""MCP Adapter 的数据契约。

这些模型与 `frontend/lib/provider/types.ts` **一一对应**，
是前后端之间唯一的类型接缝。字段命名（含 camelCase 的 `fetchedAt`）
刻意与前端保持一致，避免在序列化层再做一次映射。

⚠️ 这里不包含、也不会包含任何 MCP Token。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# 数据来源标识：前端据此显示「演示数据 / 实时数据」徽标
DataSource = Literal["mock", "mcp"]


class Meal(BaseModel):
    """餐品。前六项对齐 MCP `query-meals` 的返回形态。"""

    code: str
    name: str
    price: float
    kcal: int
    category: str
    tags: list[str] = Field(default_factory=list)

    # 以下五个匹配轴在真实 MCP 数据中不存在，由标签与营养数据推导
    spice: float = 0.0
    sweet: float = 0.0
    caffeine: float = 0.0
    filling: float = 0.0
    shareable: float = 0.0


class Coupon(BaseModel):
    """优惠券，对应 MCP `query-store-coupons`。"""

    id: str
    name: str
    threshold: float
    discount: float


class Nutrition(BaseModel):
    """营养数据，对应 MCP `list-nutrition-foods`。"""

    code: str
    energy_kcal: float
    protein_g: float
    fat_g: float
    carbohydrate_g: float
    sodium_mg: float


# ---------------------------------------------------------------------------
# 接口响应模型
# ---------------------------------------------------------------------------
class MenuResponse(BaseModel):
    meals: list[Meal]
    source: DataSource
    fetchedAt: str


class PromotionsResponse(BaseModel):
    coupons: list[Coupon]


class CartItem(BaseModel):
    code: str
    qty: int = 1


class CalculateRequest(BaseModel):
    items: list[CartItem]


class PriceQuote(BaseModel):
    """价格计算结果，对应 MCP `calculate-price`。"""

    original: float
    coupon: Coupon | None = None
    payable: float
    saved: float
    source: DataSource
