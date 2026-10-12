"""把「外部数据」归一化成 Adapter 的 schema。

外部数据有两个来源，形态都不受我们控制：
  1. `fixtures/*.json`（本地演示数据，形态已知）
  2. 麦当劳 MCP 的实时返回（**形态未经验证**）

因此这里全部采用**容错式**写法：多字段名候选、多层结构解包、
分类名映射、缺失值兜底。任何一层失败都不抛异常，只跳过该条记录。

⚠️ 关于 MCP 真实返回：本模块的字段候选与解包规则是依据 MCP 规范
（`tools/call` 返回 `content[]` 文本块）**推断**的，尚未经真实调用验证。
拿到 Token 后若发现字段不符，只需在此文件补充候选名，无需改动其他模块。
"""

from __future__ import annotations

import json
import re
from typing import Any

from backend.mcp.errors import McpBusinessError
from backend.mcp.schemas import Coupon, Meal, Nutrition

# ---------------------------------------------------------------------------
# 基础工具
# ---------------------------------------------------------------------------


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _num(value: Any, default: float = 0.0) -> float:
    """宽松取数：字符串数字也能解析。"""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value)
        if match:
            return float(match.group(0))
    return default


def pick(raw: dict[str, Any], *keys: str, default: Any = None) -> Any:
    """按候选键依次取值，跳过 None 与空串。"""
    for key in keys:
        if key in raw:
            value = raw[key]
            if value is not None and value != "":
                return value
    return default


# ---------------------------------------------------------------------------
# 分类归一化
# ---------------------------------------------------------------------------
_CATEGORY_RULES: list[tuple[tuple[str, ...], str]] = [
    (("套餐", "combo", "meal", "set"), "套餐"),
    (("小食", "side", "snack", "fries", "wing"), "小食"),
    (("饮品", "drink", "beverage", "coffee", "tea", "juice"), "饮品"),
    (("甜品", "dessert", "sweet", "ice", "sundae"), "甜品"),
]


def normalize_category(raw: dict[str, Any]) -> str:
    """把任意分类名映射到前端引擎认识的四个值之一。

    这一步很关键：前端的推荐引擎靠 `category == "套餐"` 区分主餐与搭配，
    如果直接透传 MCP 的分类名，引擎会找不到任何主餐。
    """
    raw_category = str(
        pick(raw, "category", "categoryName", "type", "productType", default="")
    ).lower()

    for keywords, mapped in _CATEGORY_RULES:
        if any(k in raw_category for k in keywords):
            return mapped

    # 分类名无法识别时，用热量与标签推断
    tags = _normalize_tags(pick(raw, "tags", "labels", "tagList", default=[]))
    kcal = _num(pick(raw, "kcal", "energy", "energyKcal", "calorie"), 0)

    if any(t in ("甜", "dessert") for t in tags):
        return "甜品"
    if kcal >= 450:
        return "套餐"
    if kcal >= 200:
        return "小食"
    if kcal > 0:
        return "饮品"

    return "套餐"


def _normalize_tags(value: Any) -> list[str]:
    """标签可能是数组，也可能是逗号/斜杠分隔的字符串。"""
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        return [t for t in re.split(r"[,，/|\s]+", value) if t]
    return []


# ---------------------------------------------------------------------------
# 匹配轴推导
# ---------------------------------------------------------------------------
def derive_axes(raw: dict[str, Any], max_kcal: int) -> dict[str, float]:
    """由标签与热量推导五个匹配轴。

    真实 MCP 不返回这些字段，它们只由标签与营养数据推导而来。
    规则刻意保持简单可解释，以便行为可预期。
    """
    tags = set(_normalize_tags(pick(raw, "tags", "labels", "tagList", default=[])))
    kcal = _num(pick(raw, "kcal", "energy", "energyKcal", "calorie"), 0)
    category = normalize_category(raw)

    if "辣" in tags:
        spice = 0.9
    elif "不辣" in tags:
        spice = 0.0
    else:
        spice = 0.0

    if "甜" in tags:
        sweet = 0.95
    elif "含糖" in tags:
        sweet = 0.6
    else:
        sweet = 0.0

    if "咖啡因" in tags:
        caffeine = 1.0
    elif "含糖" in tags:
        caffeine = 0.2
    else:
        caffeine = 0.0

    filling = clamp01(kcal / max_kcal) if max_kcal else 0.0

    shareable = {"小食": 0.75, "饮品": 0.6, "甜品": 0.35}.get(category, 0.35)

    return {
        "spice": spice,
        "sweet": sweet,
        "caffeine": caffeine,
        "filling": filling,
        "shareable": shareable,
    }


# ---------------------------------------------------------------------------
# MCP 工具返回解包
# ---------------------------------------------------------------------------
def extract_payload(result: Any) -> Any:
    """解开 MCP `tools/call` 的外层信封，返回业务载荷。

    真实返回形态（已用真实 Token 验证）：

        {"result": {
            "content": [ ... ],
            "isError": false,
            "structuredContent": {
                "success": true, "code": 200, "message": "请求成功",
                "datetime": "...", "traceId": "...", "data": ...
            }
        }}

    因此优先级为：
      1. `structuredContent` —— 真实 MCP 用它承载业务数据
      2. `content[].text` 里的 JSON —— 部分实现走这条路径
      3. 裸对象 —— 兜底

    ⚠️ 不要返回 `content` 的原始文本：它可能包含**个人数据**
    （例如地址查询会带出收件人姓名与地址），让它流进日志或响应体是严重事故。
    """
    if isinstance(result, dict):
        structured = result.get("structuredContent")
        if isinstance(structured, dict):
            return structured

        if "content" in result:
            parts: list[str] = []
            for block in result.get("content") or []:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(str(block.get("text") or ""))

            text = "\n".join(parts).strip()
            if text:
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    return {"data": text}
                if isinstance(parsed, dict):
                    return parsed

        return result

    if isinstance(result, list):
        return {"data": result}

    return {"data": result}


def ensure_success(payload: Any, tool: str | None = None) -> Any:
    """业务层校验：`success=false` 时抛出 `McpBusinessError`。

    真实场景举例（已实测）：门店打烊时 `query-meals` 返回
    `{"success": false, "code": 600057, "message": "门店可能已关闭或不在营业时间"}`。

    抛出后由 Adapter 捕获并降级到 Mock —— 这正是我们想要的行为：
    宁可显示演示数据，也不给出一个空菜单或错误价格。
    """
    if isinstance(payload, dict) and payload.get("success") is False:
        raise McpBusinessError(
            code=payload.get("code"),
            message=str(payload.get("message") or "MCP 工具返回失败"),
            tool=tool,
        )
    return payload


# ---------------------------------------------------------------------------
# 紧凑表格解析（list-nutrition-foods 的真实返回格式）
# ---------------------------------------------------------------------------
_TABLE_HEADER = re.compile(r"^\[(\d+)\]\{([^}]+)\}:\s*$")


def parse_table(text: str) -> list[dict[str, Any]]:
    """解析 `list-nutrition-foods` 返回的紧凑表格文本。

    真实格式（已实测，160 行）：

        [160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
          猪柳麦满分,null,1288,308,16,16,24,781,213
          中薯条,null,1210,289,4,12,38,165,18

    首行声明总行数与列名，后续每行以逗号分隔。`null` 视为缺失。

    已知限制：若某个值本身含逗号，列数会对不上——此时跳过该行而不是错位解析。
    """
    if not isinstance(text, str) or not text.strip():
        return []

    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    header = _TABLE_HEADER.match(lines[0].strip())
    if not header:
        return []

    fields = [f.strip() for f in header.group(2).split(",") if f.strip()]
    if not fields:
        return []

    rows: list[dict[str, Any]] = []
    for line in lines[1:]:
        values = [v.strip() for v in line.strip().split(",")]
        if len(values) != len(fields):
            # 列数不符说明该行含逗号，跳过以免错位
            continue
        rows.append(
            {
                key: (None if value in ("null", "") else value)
                for key, value in zip(fields, values)
            }
        )

    return rows


_ITEM_KEYS = (
    "items",
    "meals",
    "products",
    "foods",
    "coupons",
    "list",
    "data",
    "result",
    "records",
)


def find_items(payload: Any) -> list[dict[str, Any]]:
    """在不确定的层级里找出记录数组。"""
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]

    if isinstance(payload, dict):
        for key in _ITEM_KEYS:
            value = payload.get(key)
            if isinstance(value, list):
                return [x for x in value if isinstance(x, dict)]
            if isinstance(value, dict):
                nested = find_items(value)
                if nested:
                    return nested

    return []


def max_kcal_of(raw_items: list[dict[str, Any]]) -> int:
    return int(max((_num(pick(i, "kcal", "energy", "energyKcal"), 0) for i in raw_items), default=0))


# ---------------------------------------------------------------------------
# 记录 → schema
# ---------------------------------------------------------------------------
def to_meal(raw: dict[str, Any], max_kcal: int) -> Meal:
    axes = derive_axes(raw, max_kcal)

    return Meal(
        code=str(pick(raw, "code", "productCode", "sku", "id", default="")),
        name=str(pick(raw, "name", "productName", "title", default="")),
        price=_num(pick(raw, "price", "currentPrice", "salePrice", "amount"), 0),
        kcal=int(_num(pick(raw, "kcal", "energy", "energyKcal", "calorie"), 0)),
        category=normalize_category(raw),
        tags=_normalize_tags(pick(raw, "tags", "labels", "tagList", default=[])),
        spice=float(raw.get("spice", axes["spice"])),
        sweet=float(raw.get("sweet", axes["sweet"])),
        caffeine=float(raw.get("caffeine", axes["caffeine"])),
        filling=float(raw.get("filling", axes["filling"])),
        shareable=float(raw.get("shareable", axes["shareable"])),
    )


def to_coupon(raw: dict[str, Any]) -> Coupon:
    return Coupon(
        id=str(pick(raw, "couponId", "id", "code", default="")),
        name=str(pick(raw, "name", "couponName", "title", default="")),
        threshold=_num(pick(raw, "threshold", "minAmount", "condition"), 0),
        discount=_num(pick(raw, "discount", "amount", "value"), 0),
    )


def to_nutrition(raw: dict[str, Any]) -> Nutrition:
    """营养记录。

    真实数据来自紧凑表格，字段名为驼峰式且**没有商品编码**
    （`productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium`），
    因此用 `productName` 兜底作为标识。
    """
    return Nutrition(
        code=str(
            pick(raw, "code", "productCode", "id", "productName", default="")
        ),
        energy_kcal=_num(
            pick(raw, "energy_kcal", "energyKcal", "kcal", "energy"), 0
        ),
        protein_g=_num(pick(raw, "protein_g", "protein"), 0),
        fat_g=_num(pick(raw, "fat_g", "fat"), 0),
        carbohydrate_g=_num(
            pick(raw, "carbohydrate_g", "carbohydrate", "carbs"), 0
        ),
        sodium_mg=_num(pick(raw, "sodium_mg", "sodium"), 0),
    )
