import { DIMENSIONS, QUESTIONS } from "@/data/questions";
import { PERSONAS } from "@/data/personas";
import type {
  AnswerContext,
  Answers,
  DimensionKey,
  Persona,
  PersonaResult,
  PersonaVector,
} from "@/lib/types";

/**
 * 麦门人格匹配算法。
 *
 * 流程：
 *   6 题作答 → 构建六维向量 → 中心化 → 与 8 个原型算余弦相似度
 *   → 取 Top1 为本命人格 → 差距过小则判定混合型 → 计算置信度
 */

/** 维度初始中位值 */
const BASE = 0.5;

/** 溢出影响的融合权重 */
const SPILLOVER_WEIGHT = 0.35;

/**
 * 混合型判定阈值：Top1 与 Top2 差距小于此值即为混合型。
 *
 * 该值由穷举全部 6144 种作答组合后标定：
 *   0.05 → 40.2%（太泛滥，稀释「我有一个身份」的感觉）
 *   0.02 → 17.9%（约 1/5.5，既有特别感又不常见）✅ 采用
 *   0.01 →  9.5%（过于稀有，多数人无法体验混合型）
 */
export const MIXED_THRESHOLD = 0.02;

/** 构建一个各维均为中位值的空向量 */
function neutralVector(): PersonaVector {
  return DIMENSIONS.reduce((acc, d) => {
    acc[d.key] = BASE;
    return acc;
  }, {} as PersonaVector);
}

/**
 * 由作答构建六维向量。
 *
 * 1. 每道题的主维度直接取所选选项的 value（一题一维，不存在叠加歧义）
 * 2. 再统一施加 spillover，对相邻维度做加权融合
 */
export function buildVector(answers: Answers): PersonaVector {
  const vector = neutralVector();

  // 第一步：主维度赋值
  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!optionId) continue;

    const option = question.options.find((o) => o.id === optionId);
    if (!option) continue;

    vector[question.dimension] = clamp01(option.value);
  }

  // 第二步：施加溢出影响（统一在主维度赋值之后，保证结果与选项顺序无关）
  for (const question of QUESTIONS) {
    const optionId = answers[question.id];
    if (!optionId) continue;

    const option = question.options.find((o) => o.id === optionId);
    if (!option?.spillover) continue;

    for (const [key, value] of Object.entries(option.spillover)) {
      if (typeof value !== "number") continue;
      const dim = key as DimensionKey;
      vector[dim] = clamp01(
        vector[dim] * (1 - SPILLOVER_WEIGHT) + value * SPILLOVER_WEIGHT
      );
    }
  }

  return vector;
}

/**
 * 中心化余弦相似度（等价于 Pearson 相关系数），返回 0–1。
 *
 * 为什么必须中心化：
 *   所有向量都落在 [0,1]^6 的正象限内，普通余弦相似度会让任意两个向量
 *   都得到 0.9 以上的分数，8 种人格彼此无法区分。减去中位值 0.5 之后，
 *   区分度才足以支撑一个可信的匹配结果。
 */
export function centeredCosine(a: PersonaVector, b: PersonaVector): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const d of DIMENSIONS) {
    const va = a[d.key] - BASE;
    const vb = b[d.key] - BASE;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  // 退化情况：与中位线完全重合，视为中性
  if (normA === 0 || normB === 0) return BASE;

  const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return (cos + 1) / 2;
}

type ScoredPersona = { persona: Persona; score: number };

/** 与全部原型计算相似度，按分数降序排列 */
export function rankPersonas(vector: PersonaVector): ScoredPersona[] {
  return PERSONAS.map((persona) => ({
    persona,
    score: centeredCosine(vector, persona.vector),
  })).sort((x, y) => y.score - x.score);
}

/**
 * 完整评分：作答 → 人格结果。
 */
export function scoreAnswers(answers: Answers): PersonaResult {
  const vector = buildVector(answers);
  const ranked = rankPersonas(vector);

  const top1 = ranked[0];
  const top2 = ranked[1];

  const gap = top1.score - (top2?.score ?? top1.score);

  // 置信度：差距越大越自信，映射到 60–99
  const confidence = Math.max(60, Math.min(99, Math.round(60 + gap * 120)));

  const isMixed = top2 !== undefined && gap < MIXED_THRESHOLD;

  return {
    code: top1.persona.code,
    name: top1.persona.name,
    emoji: top1.persona.emoji,
    vector,
    confidence,
    secondaryCode: isMixed ? top2.persona.code : undefined,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 由作答推导可读上下文（预算 / 场景 / 状态），用于档案页与推荐卡片。
 */
export function deriveContext(answers: Answers): AnswerContext {
  const pick = (questionId: string, tagKey: string): string | undefined => {
    const optionId = answers[questionId];
    if (!optionId) return undefined;
    const option = QUESTIONS.find((q) => q.id === questionId)?.options.find(
      (o) => o.id === optionId
    );
    return option?.tags?.[tagKey];
  };

  const moodOption = answers["q1"]
    ? QUESTIONS[0].options.find((o) => o.id === answers["q1"])
    : undefined;

  return {
    budget: pick("q2", "budget") ?? "30–50",
    scene: pick("q3", "scene") ?? "夜宵",
    mood: moodOption?.label ?? "常规一餐",
  };
}

/** 判断作答是否完整 */
export function isComplete(answers: Answers): boolean {
  return QUESTIONS.every((q) => Boolean(answers[q.id]));
}

/** 作答进度 0–1 */
export function progressOf(answers: Answers): number {
  const answered = QUESTIONS.filter((q) => Boolean(answers[q.id])).length;
  return answered / QUESTIONS.length;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
