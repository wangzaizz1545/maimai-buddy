/**
 * /recommend 页面数据链路端到端验证（临时脚本）。
 *
 * 模拟页面里 `useEffect` 的实际调用顺序：
 *   readPersona → loadRecommendContext() → recommend(persona, vector, ceiling, data)
 *
 * 验证三种情形下「数据来源徽标」会显示什么：
 *   1. 后端可用（fixture 模式）  → 走 HTTP，source 由后端决定
 *   2. 后端不可用               → 降级到本地，degraded = true
 *   3. 数据为空                 → 引擎回退，页面不崩
 */
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import { loadRecommendContext } from "@/lib/provider";
import { budgetCeilingOf, recommend } from "@/lib/recommend";
import { deriveContext } from "@/lib/scoring";
import type { Answers } from "@/lib/types";

const ANSWERS: Answers = {
  q1: "q1_tired",
  q2: "q2_mid",
  q3: "q3_night",
  q4: "q4_spicy",
  q5: "q5_now",
  q6: "q6_coffee",
};

function badge(source: string, degraded: boolean): string {
  if (source === "mcp") return "🟢 实时数据";
  return degraded ? "🟡 演示数据 · 后端未连接" : "🟡 演示数据";
}

async function main() {
  const persona = getPersona(DEFAULT_PERSONA.code) ?? DEFAULT_PERSONA;
  const context = deriveContext(ANSWERS);
  const ceiling = budgetCeilingOf(ANSWERS);

  console.log("=== 模拟页面取数 ===");
  const loaded = await loadRecommendContext();

  console.log(`  context.meals   : ${loaded.context.meals.length} 项`);
  console.log(`  context.coupons : ${loaded.context.coupons.length} 张`);
  console.log(`  context.source  : ${loaded.context.source}`);
  console.log(`  provider        : ${loaded.provider.id}`);
  console.log(`  degraded        : ${loaded.degraded}`);
  console.log(`  页面徽标        : ${badge(loaded.context.source, loaded.degraded)}`);

  console.log("\n=== 用该数据跑一次推荐 ===");
  const rec = recommend(persona, DEFAULT_PERSONA.vector, ceiling, {
    meals: loaded.context.meals,
    coupons: loaded.context.coupons,
  });
  console.log(
    `  推荐   : ${[rec.main.name, rec.side?.name].filter(Boolean).join(" + ")}`
  );
  console.log(
    `  价格   : 原价 ¥${rec.pricing.original.toFixed(1)} → 券后 ¥${rec.pricing.payable.toFixed(1)}`
  );
  console.log(`  券     : ${rec.pricing.coupon?.name ?? "暂无可用券"}`);
  console.log(`  匹配度 : ${rec.matchScore}%`);
  console.log(`  场景   : 预算 ${context.budget} · ${context.scene}`);

  console.log("\n=== 空数据回退（模拟后端返回空菜单）===");
  const empty = recommend(persona, DEFAULT_PERSONA.vector, ceiling, {
    meals: [],
    coupons: [],
  });
  console.log(`  仍然给出推荐: ${empty.main.name}  （引擎回退到本地演示数据）`);
  console.log(`  无券          : ${empty.pricing.coupon === null ? "是（显示「暂无」）" : "否"}`);
}

main();
