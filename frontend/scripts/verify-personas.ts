/**
 * 临时验证脚本（验证完成后删除，不进入仓库）。
 *
 * 目的：穷举全部作答组合，证明
 *   1. 8 种人格全部可达（不会有人永远测不出来）
 *   2. 不同作答会得到不同人格（结果不是写死的）
 *   3. 置信度与混合型判定落在合理区间
 */
import { PERSONAS } from "@/data/personas";
import { QUESTIONS } from "@/data/questions";
import { deriveContext, scoreAnswers } from "@/lib/scoring";
import type { Answers } from "@/lib/types";

const optionIds = QUESTIONS.map((q) => q.options.map((o) => o.id));
const total = optionIds.reduce((n, arr) => n * arr.length, 1);

function* combinations(i = 0, acc: Answers = {}): Generator<Answers> {
  if (i === QUESTIONS.length) {
    yield { ...acc };
    return;
  }
  for (const id of optionIds[i]) {
    acc[QUESTIONS[i].id] = id;
    yield* combinations(i + 1, acc);
  }
}

console.log(`枚举全部 ${total} 种作答组合 ...\n`);

const tally = new Map<string, number>();
const example = new Map<string, Answers>();
let mixedCount = 0;
let minConf = 100;
let maxConf = 0;

for (const answers of combinations()) {
  const result = scoreAnswers(answers);
  tally.set(result.code, (tally.get(result.code) ?? 0) + 1);
  if (result.secondaryCode) mixedCount += 1;
  minConf = Math.min(minConf, result.confidence);
  maxConf = Math.max(maxConf, result.confidence);
  if (!example.has(result.code)) example.set(result.code, answers);
}

console.log("=== 人格可达性 ===");
let unreachable = 0;
for (const persona of PERSONAS) {
  const n = tally.get(persona.code) ?? 0;
  if (n === 0) unreachable += 1;
  const pct = ((n / total) * 100).toFixed(1);
  const mark = n === 0 ? "[X] 不可达" : "[OK]      ";
  console.log(
    `${mark} ${persona.emoji} ${persona.name}  ${String(n).padStart(5)} 组 (${pct}%)`
  );
}

console.log("\n=== 指标 ===");
console.log(`可达人格数    : ${PERSONAS.length - unreachable} / ${PERSONAS.length}`);
console.log(`混合型占比    : ${((mixedCount / total) * 100).toFixed(1)}%`);
console.log(`置信度区间    : ${minConf} – ${maxConf}`);

console.log("\n=== 抽样：不同作答 → 不同人格 ===");
const samples: Answers[] = [
  { q1: "q1_tired", q2: "q2_mid", q3: "q3_night", q4: "q4_spicy", q5: "q5_now", q6: "q6_coffee" },
  { q1: "q1_plain", q2: "q2_low", q3: "q3_lunch", q4: "q4_classic", q5: "q5_classic", q6: "q6_meat" },
  { q1: "q1_reward", q2: "q2_free", q3: "q3_party", q4: "q4_sweet", q5: "q5_now", q6: "q6_people" },
  { q1: "q1_tired", q2: "q2_mid", q3: "q3_overtime", q4: "q4_classic", q5: "q5_review", q6: "q6_sweet" },
];

for (const answers of samples) {
  const r = scoreAnswers(answers);
  const ctx = deriveContext(answers);
  const second = r.secondaryCode ? ` × ${r.secondaryCode}` : "";
  console.log(
    `${r.emoji} ${r.name}${second}  (置信度 ${r.confidence})  ` +
      `预算=${ctx.budget} 场景=${ctx.scene}`
  );
}

console.log(unreachable === 0 ? "\n结论：全部人格可达 ✅" : "\n结论：存在不可达人格 ❌");
