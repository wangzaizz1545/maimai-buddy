/**
 * UI 数据链路验证（手动运行，非构建产物的一部分）。
 *
 * /result、/share、/buddy 的内容都依赖 localStorage，无法从静态 HTML 验证，
 * 因此这里模拟这三页的完整取数链路，对全部 8 种人格各跑一遍：
 *
 *   answers → scoreAnswers → getPersona → themeOf → 页面所需字段
 *   buildProfile → BuddyProfile 字段
 *
 * 运行：pnpm dlx tsx scripts/verify-ui-data.ts
 */
import { MEMORIES_BY_PERSONA, buildProfile } from "@/data/mockProfile";
import { DEFAULT_PERSONA, PERSONAS, getPersona } from "@/data/personas";
import { DIMENSIONS, QUESTIONS } from "@/data/questions";
import { deriveContext, scoreAnswers } from "@/lib/scoring";
import { themeOf } from "@/lib/theme";
import type { Answers } from "@/lib/types";

const optionIds = QUESTIONS.map((q) => q.options.map((o) => o.id));

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

// 为每种人格找一组能命中它的作答
const sampleByPersona = new Map<string, Answers>();
for (const answers of combinations()) {
  const code = scoreAnswers(answers).code;
  if (!sampleByPersona.has(code)) sampleByPersona.set(code, answers);
  if (sampleByPersona.size === PERSONAS.length) break;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

console.log(`覆盖人格：${sampleByPersona.size} / ${PERSONAS.length}\n`);

let problems = 0;

for (const persona of PERSONAS) {
  const answers = sampleByPersona.get(persona.code);
  if (!answers) {
    console.log(`[X] ${persona.name}：无样例作答`);
    problems += 1;
    continue;
  }

  const result = scoreAnswers(answers);
  const resolved = getPersona(result.code) ?? DEFAULT_PERSONA;
  const theme = themeOf(resolved);
  const context = deriveContext(answers);
  const profile = buildProfile(resolved.code, context);
  const memories = MEMORIES_BY_PERSONA[resolved.code] ?? [];

  const top = DIMENSIONS.map((d) => ({
    label: d.label,
    value: result.vector[d.key] ?? 0,
  })).sort((a, b) => b.value - a.value)[0];

  const checks: [string, boolean][] = [
    // /result
    ["tagline 非空", resolved.tagline.length > 0],
    ["traits=3", resolved.traits.length === 3],
    ["scenes>=3", resolved.scenes.length >= 3],
    ["向量完整", DIMENSIONS.every((d) => typeof result.vector[d.key] === "number")],
    ["首要维度>0.5", top.value > 0.5],
    // /share 海报
    ["渐变起点合法", HEX.test(theme.from)],
    ["渐变终点合法", HEX.test(theme.to)],
    ["强调色合法", HEX.test(theme.accent)],
    ["cardGradient 合法", theme.cardGradient.startsWith("linear-gradient(")],
    ["shareText 非空", resolved.shareText.length > 0],
    ["mood 非空", context.mood.length > 0],
    // /buddy 档案
    ["记忆=3 条", memories.length === 3],
    ["口味 1–5", profile.taste.level >= 1 && profile.taste.level <= 5],
    ["预算非空", profile.budget.length > 0],
    ["场景非空", profile.scene.length > 0],
  ];

  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) problems += 1;

  console.log(
    `${failed.length ? "[X]" : "[OK]"} ${resolved.emoji} ${resolved.name}` +
      `   渐变 ${theme.from} → ${theme.to}` +
      `   档案 口味${"★".repeat(profile.taste.level)} / 预算 ${profile.budget} / 场景 ${profile.scene}` +
      (failed.length ? `\n      失败项：${failed.join(", ")}` : "")
  );
}

console.log(
  problems === 0
    ? `\n结论：8 种人格在 /result、/share、/buddy 三页数据均完整 ✅`
    : `\n结论：${problems} 种人格存在问题 ❌`
);
