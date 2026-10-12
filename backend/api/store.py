"""门店接口（只读）。

职责边界与 `recommend.py` 一致：**只接参数、调 Adapter、返回模型**，
不含任何搜索或排序逻辑。

数据来源：MCP `query-nearby-stores`。

⚠️ `query-nearby-stores` 的两种模式（已用真实 Token 实测）：

| searchType | 必填 | 返回营业状态 |
|---|---|---|
| 1（收藏门店） | 无 | ❌ 不含 `businessStatus` |
| 2（城市 + 关键词） | **city 与 keyword 同时提供** | ✅ 含 `businessStatus` 与营业时间 |

只给其中一个会返回 `600058 城市名或者关键词不能为空`，
因此本层直接拦截这种请求并返回清晰提示，而不是把错误透传给前端。
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from backend.mcp import adapter
from backend.mcp.schemas import StoreSearchResponse

router = APIRouter(prefix="/api/store", tags=["store"])


@router.get("/search", response_model=StoreSearchResponse, summary="搜索门店")
def search_stores(
    city: str = Query("", description="城市名，与 keyword 需同时提供"),
    keyword: str = Query("", description="关键词（商圈 / 地标 / 路名）"),
) -> StoreSearchResponse:
    """按城市 + 关键词搜索门店。

    - 两者都为空 → 返回**收藏门店**（`query-nearby-stores` searchType=1）
    - 两者都提供 → 按城市搜索（searchType=2），**结果包含营业状态**
    - 只提供一个 → 400，并说明原因

    `source` 字段与菜单接口同一套语义：`mock` = 演示数据，`mcp` = 实时数据。
    """
    city = city.strip()
    keyword = keyword.strip()

    if bool(city) != bool(keyword):
        raise HTTPException(
            status_code=400,
            detail="城市与关键词需要同时提供（麦当劳 MCP 的搜索接口要求二者都不为空）。"
            "两者都留空则返回你的收藏门店。",
        )

    stores = adapter.search_stores(city, keyword)

    return StoreSearchResponse(
        stores=stores,
        source=adapter.current_source(),
        fetchedAt=adapter.now_iso(),
        city=city,
        keyword=keyword,
        mode="search" if city and keyword else "favorites",
    )
