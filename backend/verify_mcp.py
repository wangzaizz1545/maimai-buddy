"""MCP 层验证脚本。

用法（在项目根目录执行）：

    .venv/Scripts/python.exe backend/verify_mcp.py      # Windows
    .venv/bin/python backend/verify_mcp.py              # macOS / Linux

它做四件事：
  1. 检查配置读取（含占位值防护、非法模式回落）
  2. 检查归一化层（标签推导、分类映射、MCP 信封解包）
  3. 检查 Adapter 在 fixture / live 两种模式下的行为与降级
  4. **若已配置真实 Token，则做一次真实连通性冒烟测试**

本脚本不会打印、记录或以任何形式输出 Token 内容。
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.mcp import adapter, config, normalize  # noqa: E402
from backend.mcp.live_provider import (  # noqa: E402
    McpAuthError,
    McpBusinessError,
    LiveProvider,
)
from backend.mcp.schemas import CartItem  # noqa: E402

failures = 0


def check(label: str, ok: bool, extra: str = "") -> None:
    global failures
    if not ok:
        failures += 1
    print(f"  {'[OK]' if ok else '[X] '} {label}{'  ' + extra if extra else ''}")


def section(title: str) -> None:
    print(f"\n=== {title} ===")


# ---------------------------------------------------------------------------
section("1. 配置读取")
# ---------------------------------------------------------------------------
_original = {k: os.environ.get(k) for k in ("MCD_MCP_TOKEN", "MCBUDDY_MCP", "MCP_BASE_URL")}

os.environ.pop("MCD_MCP_TOKEN", None)
check("未设置 Token 时返回空", config.get_mcp_token() == "")
check("has_mcp_token 为 False", config.has_mcp_token() is False)

os.environ["MCD_MCP_TOKEN"] = "your_token_here"
check("占位值被识别为未配置", config.get_mcp_token() == "", "your_token_here → 空")

os.environ["MCD_MCP_TOKEN"] = "a-real-looking-token-12345"
check("真实值可读出", config.get_mcp_token() == "a-real-looking-token-12345")
check("has_mcp_token 为 True", config.has_mcp_token() is True)

os.environ["MCBUDDY_MCP"] = "live"
check("mode = live", config.get_mcp_mode() == "live")
os.environ["MCBUDDY_MCP"] = "GARBAGE"
check("非法模式回落 fixture", config.get_mcp_mode() == "fixture", "GARBAGE → fixture")
os.environ["MCBUDDY_MCP"] = "LIVE"
check("大小写不敏感", config.get_mcp_mode() == "live")

os.environ.pop("MCP_BASE_URL", None)
check("默认 base_url", config.get_mcp_base_url() == "https://mcp.mcd.cn")

description = config.describe()
check("describe 不含 Token 内容", "a-real-looking-token" not in str(description))
check("describe 只报告是否已配置", description["token_configured"] is True)

# 还原环境
os.environ["MCD_MCP_TOKEN"] = "your_token_here"
os.environ["MCBUDDY_MCP"] = "fixture"

# ---------------------------------------------------------------------------
section("2. 归一化层")
# ---------------------------------------------------------------------------
raw_meal = {"code": "X1", "name": "测试辣堡", "price": "35", "kcal": 780, "tags": ["辣", "招牌"]}
axes = normalize.derive_axes(raw_meal, 920)
check("标签→辣度", axes["spice"] == 0.9)
check("热量→满足感", abs(axes["filling"] - 780 / 920) < 1e-6)

check("分类：中文套餐", normalize.normalize_category({"category": "套餐"}) == "套餐")
check("分类：英文 combo", normalize.normalize_category({"category": "Combo Meal"}) == "套餐")
check("分类：小食", normalize.normalize_category({"category": "小食"}) == "小食")
check("分类：未知靠热量推断", normalize.normalize_category({"category": "??", "kcal": 800}) == "套餐")

envelope = {"content": [{"type": "text", "text": '{"items":[{"code":"A"}]}'}], "isError": False}
check("解包 MCP 信封", normalize.find_items(normalize.extract_payload(envelope)) == [{"code": "A"}])
check("解包裸对象", normalize.find_items({"items": [{"code": "B"}]}) == [{"code": "B"}])
check("解包嵌套", normalize.find_items({"data": {"list": [{"code": "C"}]}}) == [{"code": "C"}])

meal = normalize.to_meal({"productCode": "P9", "productName": "外部辣堡", "currentPrice": "33.5", "energy": 700, "labels": "辣,招牌"}, 900)
check("字段名容错", meal.code == "P9" and meal.price == 33.5, f"{meal.name} ¥{meal.price}")
check("标签字符串切分", meal.tags == ["辣", "招牌"], str(meal.tags))

# ---------------------------------------------------------------------------
section("3. Adapter（fixture 模式）")
# ---------------------------------------------------------------------------
os.environ["MCBUDDY_MCP"] = "fixture"
adapter._providers.clear()

meals = adapter.get_menu()
check("可取到菜单", len(meals) > 0, f"{len(meals)} 项")
check("source = mock", adapter.current_source() == "mock")

quote = adapter.calculate([CartItem(code="SP001", qty=1)])
check("算价正确", quote.original == 35.0 and quote.payable == 28.0, f"¥{quote.original} → ¥{quote.payable}")
check("券已套用", quote.coupon is not None, quote.coupon.name if quote.coupon else "无")

# ---------------------------------------------------------------------------
section("4. Adapter（live 模式但未配置 Token → 应优雅降级）")
# ---------------------------------------------------------------------------
os.environ["MCBUDDY_MCP"] = "live"
os.environ["MCD_MCP_TOKEN"] = "your_token_here"  # 占位值 = 未配置
adapter._providers.clear()

meals_live = adapter.get_menu()
check("未崩溃", True)
check("降级后仍有数据", len(meals_live) > 0, f"{len(meals_live)} 项")
check("source 如实标记为 mock", adapter.current_source() == "mock", "绝不谎报 mcp")

quote_live = adapter.calculate([CartItem(code="SP001", qty=1)])
check("降级后仍可算价", quote_live.payable == 28.0)

# ---------------------------------------------------------------------------
section("5. LiveProvider 直接调用（无 Token）")
# ---------------------------------------------------------------------------
try:
    LiveProvider().get_menu()
    check("无 Token 时应抛 McpAuthError", False, "却成功返回了")
except McpAuthError as exc:
    check("无 Token 时抛 McpAuthError", True)
    check("异常消息不含 Token", "your_token_here" not in str(exc))

# ---------------------------------------------------------------------------
# 真实连通性测试前，先还原真实的环境变量
# （第 4/5 节为了让降级路径可测，临时把 Token 改成了占位值）
# ---------------------------------------------------------------------------
for _key, _value in _original.items():
    if _value is None:
        os.environ.pop(_key, None)
    else:
        os.environ[_key] = _value

# ---------------------------------------------------------------------------
section("6. 真实连通性冒烟测试")
# ---------------------------------------------------------------------------
token = config.get_mcp_token()
if not token:
    print("  跳过：未配置真实的 MCD_MCP_TOKEN")
    print("  配置方式见 docs/MCP_SETUP.md，配置后重跑本脚本即可验证真实链路。")
else:
    print("  检测到 Token，开始真实调用 …\n")

    provider = LiveProvider()
    live_meals: list = []

    # --- 6.1 无门店依赖的只读工具（预期必定成功）---
    print("  [无需门店]")
    try:
        nutrition = provider.get_nutrition()
        check("list-nutrition-foods", len(nutrition) > 0, f"{len(nutrition)} 条")
    except Exception as exc:  # noqa: BLE001
        check("list-nutrition-foods", False, f"{type(exc).__name__}: {exc}")

    # --- 6.2 门店解析 ---
    print("\n  [门店解析]")
    store_ok = False
    try:
        store_code, order_type, be_type = provider._resolve_store()
        store_ok = True
        check(
            "query-nearby-stores",
            True,
            f"storeCode={store_code} orderType={order_type} beType={be_type}",
        )
    except Exception as exc:  # noqa: BLE001
        check("query-nearby-stores", False, f"{type(exc).__name__}: {exc}")

    # --- 6.3 门店依赖的工具 ---
    print("\n  [依赖门店]")
    if not store_ok:
        print("  跳过：未解析到门店")
    else:
        # query-meals：可能因门店打烊返回业务错误，这属于营业时间限制，不是代码缺陷
        try:
            live_meals = provider.get_menu()
            check("query-meals", len(live_meals) > 0, f"{len(live_meals)} 条")
        except McpBusinessError as exc:
            print(f"  [--] query-meals  业务限制（非代码问题）：{exc}")
            print("       → 门店打烊时属预期行为，Adapter 会降级到演示数据")
        except Exception as exc:  # noqa: BLE001
            check("query-meals", False, f"{type(exc).__name__}: {exc}")

        # query-store-coupons：无券是合法结果，返回空列表即正确
        try:
            coupons = provider.get_promotions()
            check(
                "query-store-coupons",
                isinstance(coupons, list),
                f"{len(coupons)} 张（空列表也是正确结果）",
            )
        except McpBusinessError as exc:
            print(f"  [--] query-store-coupons  业务限制：{exc}")
        except Exception as exc:  # noqa: BLE001
            check("query-store-coupons", False, f"{type(exc).__name__}: {exc}")

        # calculate-price：必须用真实菜单里的编码，没有真实菜单就跳过
        if live_meals:
            try:
                quote = provider.calculate_price(
                    [CartItem(code=live_meals[0].code, qty=1)]
                )
                check(
                    "calculate-price",
                    quote.payable >= 0,
                    f"{live_meals[0].name} ¥{quote.original} → ¥{quote.payable}",
                )
            except Exception as exc:  # noqa: BLE001
                check("calculate-price", False, f"{type(exc).__name__}: {exc}")
        else:
            print("  [--] calculate-price  跳过：需要真实菜单编码，当前菜单不可用")

print()
print("MCP 层：全部通过 ✅" if failures == 0 else f"MCP 层：{failures} 项失败 ❌")
sys.exit(0 if failures == 0 else 1)
