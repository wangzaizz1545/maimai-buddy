/**
 * 推荐引擎验证（临时脚本，评审后删除）。
 *
 * 验证三件事：
 *   1. 8 种人格是否得到**不同**的推荐（否则功能是假的）
 *   2. 预算硬约束是否生效（券后价与合计不得超过上限）
 *   3. 优惠模拟与凑单提示的数值是否自洽
 */
import { PERSONAS } from "@/data/personas";
import { recommend } from "@/lib/recommend";

console.log("=== 1. 八种人格 × 相同预算（¥35）===");
console.log("人格".padEnd(20) + "推荐".padEnd(30) + "原价  券后  省  匹配");

const results = new Map<string, string>();
for (const p of PERSONAS) {
  const r = recommend(p, p.vector, 35);
  const combo = [r.main.name, r.side?.name].filter(Boolean).join(" + ");
  results.set(p.code, combo + "|" + r.pricing.payable.toFixed(1));

  console.log(
    `${(p.emoji + " " + p.name).padEnd(18)} ` +
      `${combo.padEnd(28)} ` +
      `¥${r.pricing.original.toFixed(0).padStart(2)}  ` +
      `¥${r.pricing.payable.toFixed(1).padStart(4)}  ` +
      `¥${r.pricing.saved.toFixed(0).padStart(2)}  ` +
      `${r.matchScore}%`
  );
}

const distinct = new Set(results.values()).size;
console.log(`\n不同推荐组合数：${distinct} / ${PERSONAS.length} ${distinct >= 5 ? "✅" : "❌ 过于雷同"}`);

console.log("\n=== 2. 预算硬约束（同一人格，四档预算）===");
const p = PERSONAS[7]; // 深夜代码战士
for (const ceiling of [20, 35, 50, 60]) {
  const r = recommend(p, p.vector, ceiling);
  const ok = r.pricing.original <= ceiling && r.pricing.payable <= ceiling;
  console.log(
    `  ${ok ? "[OK]" : "[X] "} 上限 ¥${String(ceiling).padStart(2)}  →  ` +
      `${[r.main.name, r.side?.name].filter(Boolean).join(" + ")}  ` +
      `合计 ¥${r.pricing.original.toFixed(1)}  券后 ¥${r.pricing.payable.toFixed(1)}`
  );
}

console.log("\n=== 3. 优惠模拟自洽性 ===");
for (const p of PERSONAS.slice(0, 4)) {
  const r = recommend(p, p.vector, 50);
  const { original, coupon, payable, saved, nextCoupon, gapToNext, toppingUpWorthIt } = r.pricing;

  const checks: [string, boolean][] = [
    ["实付 = 原价 - 优惠", Math.abs(payable - (original - saved)) < 0.001],
    ["券门槛已满足", !coupon || original >= coupon.threshold],
    ["优惠额与券一致", !coupon || saved === coupon.discount],
    ["凑单差额为正", !nextCoupon || gapToNext > 0],
    ["凑单划算性判断正确", !nextCoupon || toppingUpWorthIt === (nextCoupon.discount - gapToNext > 0)],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
  console.log(
    `  ${failed.length ? "[X] " : "[OK]"} ${p.name.padEnd(10)} ` +
      `合计 ¥${original.toFixed(1)}  券 ${coupon ? coupon.name : "无"}  ` +
      `实付 ¥${payable.toFixed(1)}` +
      (failed.length ? `  失败：${failed.join(", ")}` : "")
  );
}

console.log("\n=== 4. 推荐理由与预算建议示例（深夜代码战士 / ¥35）===");
const sample = recommend(PERSONAS[7], PERSONAS[7].vector, 35);
console.log("  理由：" + sample.reason);
console.log("  建议：" + sample.budgetTip);
console.log("  驱动轴：" + sample.drivers.map((d) => `${d.label} ${Math.round(d.fit * 100)}%`).join(" · "));
