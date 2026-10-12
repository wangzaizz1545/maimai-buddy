"""推荐相关接口（Step 3a）。

职责边界（刻意保持极窄）：
  本文件**只做三件事**——接参数、调 Adapter、返回模型。
  不含任何推荐、打分、排序逻辑；那些都在前端 `lib/recommend.ts`。

  API 层 → Adapter 层 → Provider（Mock / Live）→ 麦当劳 MCP（未来）

安全：
  - 全部只读，无副作用
  - 不返回、不记录任何凭证；MCP Token 只存在于 Adapter 下方的环境变量里
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from backend.mcp import adapter
from backend.mcp.schemas import (
    CalculateRequest,
    MenuResponse,
    PriceQuote,
    PromotionsResponse,
)

router = APIRouter(prefix="/api/recommend", tags=["recommend"])

# 用户可在 /store 页选择门店，选择结果通过该参数一路传到 MCP。
# 留空时由 Live Provider 回退到收藏门店。
StoreCodeQuery = Query(
    None,
    description="门店编码。来自 /api/store/search 的搜索结果；留空则使用收藏门店",
)


@router.get("/menu", response_model=MenuResponse, summary="推荐用菜单")
def read_menu(storeCode: str | None = StoreCodeQuery) -> MenuResponse:
    """对应 MCP `query-meals`。

    返回指定门店的可售餐品。`source` 字段用于前端诚实标注数据来源：
    `"mock"` 为演示数据，`"mcp"` 为实时数据。
    """
    return MenuResponse(
        meals=adapter.get_menu(storeCode),
        source=adapter.current_source(),
        fetchedAt=adapter.now_iso(),
    )


@router.get(
    "/promotions", response_model=PromotionsResponse, summary="推荐用优惠券"
)
def read_promotions(storeCode: str | None = StoreCodeQuery) -> PromotionsResponse:
    """对应 MCP `query-store-coupons`。"""
    return PromotionsResponse(coupons=adapter.get_promotions(storeCode))


@router.post("/calculate", response_model=PriceQuote, summary="价格计算")
def calculate_price(payload: CalculateRequest) -> PriceQuote:
    """对应 MCP `calculate-price`。

    按菜单单价合计并套用最优券。当前由 Adapter 本地计算，
    接入真实 MCP 后将改由 `calculate-price` 提供——前端契约不变。
    """
    return adapter.calculate(payload.items)
