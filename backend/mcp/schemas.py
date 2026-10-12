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


class Store(BaseModel):
    """门店，对应 MCP `query-nearby-stores`。

    真实返回中只有 `searchType=2`（城市 + 关键词）会带营业字段；
    `searchType=1`（收藏门店）不返回 `businessStatus`，因此营业状态可为空——
    前端必须能区分「已打烊」与「未知」，不能把未知当成打烊。
    """

    storeCode: str
    storeName: str
    address: str = ""

    # 距离（米）。收藏门店返回 0，视为未知
    distance: float | None = None

    # 营业状态。None = 该搜索方式未返回此字段
    businessStatus: bool | None = None
    businessStartTime: str = ""
    businessEndTime: str = ""

    # 今日可预约时段的可读文本（真实数据的 reservationTimeOptions[today]）
    hoursText: str = ""

    # 门店是否支持预约
    reservation: bool = False


# ---------------------------------------------------------------------------
# 接口响应模型
# ---------------------------------------------------------------------------
class MenuResponse(BaseModel):
    meals: list[Meal]
    source: DataSource
    fetchedAt: str


class StoreSearchResponse(BaseModel):
    """门店搜索结果。

    `source` 与菜单接口保持同一套语义：`mock` = 演示数据，`mcp` = 实时数据。
    """

    stores: list[Store]
    source: DataSource
    fetchedAt: str
    # 回显查询条件，便于前端展示「你在搜什么」以及排查空结果
    city: str = ""
    keyword: str = ""
    # 搜索方式：favorites（收藏门店）| search（城市 + 关键词）
    mode: str = "favorites"


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
