/**
 * Provider 层验证（Step 2b，临时脚本）。
 *
 * 验证三件事：
 *   1. 本地 Mock Provider 能正确提供上下文与价格
 *   2. HTTP 不可用时能自动降级，且降级后页面所需数据完整
 *   3. 降级后 provider 与 context.source 语义正确
 */
import { loadRecommendContext, localMockProvider } from "@/lib/provider";

let failed = 0;
const check = (label: string, ok: boolean, extra = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "[OK]" : "[X] "} ${label}${extra ? "  " + extra : ""}`);
};

async function main() {
  console.log("=== 1. LocalMockProvider.getContext ===");
  const ctx = await localMockProvider.getContext();
  check("餐品数量", ctx.meals.length > 0, `${ctx.meals.length} 项`);
  check("优惠券数量", ctx.coupons.length > 0, `${ctx.coupons.length} 张`);
  check("source = mock", ctx.source === "mock");
  check("fetchedAt 有效", !Number.isNaN(Date.parse(ctx.fetchedAt)));
  check(
    "匹配轴齐全",
    ctx.meals.every(
      (m) =>
        typeof m.spice === "number" &&
        typeof m.sweet === "number" &&
        typeof m.caffeine === "number" &&
        typeof m.filling === "number" &&
        typeof m.shareable === "number"
    )
  );

  console.log("\n=== 2. LocalMockProvider.calculate ===");
  const spicy = ctx.meals.find((m) => m.name.includes("麦辣鸡腿堡套餐"))!;
  const quote = await localMockProvider.calculate([{ code: spicy.code, qty: 1 }]);
  check("原价正确", quote.original === spicy.price, `¥${quote.original}`);
  check("命中满减券", Boolean(quote.coupon), quote.coupon?.name ?? "无");
  check(
    "实付 = 原价 - 优惠",
    quote.payable === quote.original - quote.saved,
    `¥${quote.payable}`
  );
  check("source = mock", quote.source === "mock");

  const low = await localMockProvider.calculate([{ code: "SP012", qty: 1 }]);
  check("低于门槛时无券", low.coupon === null, `原价 ¥${low.original}`);

  console.log("\n=== 3. 降级路径（Node 环境下 fetch 相对路径必然失败）===");
  const loaded = await loadRecommendContext();
  check("发生降级", loaded.degraded === true);
  check("降级后 provider 为本地 Mock", loaded.provider.id === "local-mock");
  check(
    "降级后仍有餐品",
    loaded.context.meals.length > 0,
    `${loaded.context.meals.length} 项`
  );
  check("降级后仍有券", loaded.context.coupons.length > 0);
  check("source 标注为 mock", loaded.context.source === "mock");

  console.log("\n=== 4. 降级后仍可完成一次完整取数 ===");
  const meals = [...loaded.context.meals]
    .filter((m) => m.category === "套餐")
    .sort((a, b) => a.price - b.price);
  const cheapest = meals[0];
  const q = await loaded.provider.calculate([{ code: cheapest.code, qty: 1 }]);
  check(
    "可取到价格",
    q.original > 0,
    `${cheapest.name} ¥${q.original} → 实付 ¥${q.payable}`
  );

  console.log(
    failed === 0 ? "\nProvider 层：全部通过 ✅" : `\nProvider 层：${failed} 项失败 ❌`
  );
}

main();
