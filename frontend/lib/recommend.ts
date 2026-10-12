/**
 * 「麦友今日推荐」匹配引擎。
 *
 * 本模块是**纯函数 + 确定性**的：同样的画像、预算与数据永远得到同样的推荐。
 *
 * 数据来源：由调用方通过 `data` 参数注入（来自 `lib/provider`），
 * 因此本模块**不关心数据来自演示 fixtures 还是真实麦当劳 MCP**。
 * 未传 `data` 时回退到 `data/mockRecommendation.ts`，便于离线单测。
 *
 * 设计要点（v2，修正了 v1 的"推荐过于雷同"问题）：
 *   v1 对**单个主餐**打分，而「恢复方式」这一轴（权重 24%）对任何纯主餐都为 0
 *   ——没有主餐同时含咖啡因或高甜度，导致 24% 的权重完全失效，所有主餐分数挤在
 *   一起，8 种人格只产出 3 种结果。
 *   v2 改为对**套餐组合（主餐 + 搭配）**打分，并让口味轴由三种取向构成凸组合，
 *   使咖啡因型人格会自然配上咖啡、安抚型人格会自然配上甜品。
 */

import {
  BUDGET_CEILING,
  DEFAULT_BUDGET_CEILING,
  MOCK_COUPONS,
  MOCK_MEALS,
} from "@/data/mockRecommendation";
import type { ProviderCoupon, ProviderMeal } from "@/lib/provider/types";
import type { Answers, DimensionKey, Persona, PersonaVector } from "@/lib/types";

// ---------------------------------------------------------------------------
// 数据注入
// ---------------------------------------------------------------------------
export type RecommendData = {
  meals: readonly ProviderMeal[];
  coupons: readonly ProviderCoupon[];
};

/** 未注入数据时的回退（离线单测与本地兜底） */
const FALLBACK_DATA: RecommendData = {
  meals: MOCK_MEALS,
  coupons: MOCK_COUPONS,
};

// ---------------------------------------------------------------------------
// 五个匹配轴的权重
// ---------------------------------------------------------------------------
const WEIGHTS: Record<string, number> = {
  taste: 0.28, // 口味偏好
  recovery: 0.24, // 恢复方式
  filling: 0.22, // 快乐需求
  price: 0.16, // 消费态度
  social: 0.1, // 社交属性
};

const AXIS_LABEL: Record<string, string> = {
  taste: "口味偏好",
  recovery: "恢复方式",
  filling: "快乐需求",
  price: "消费态度",
  social: "社交属性",
};

const AXIS_DIMENSION: Record<string, DimensionKey> = {
  taste: "taste",
  recovery: "recovery",
  filling: "happiness_need",
  price: "spending",
  social: "social",
};

export type AxisScore = {
  key: string;
  label: string;
  dimension: DimensionKey;
  fit: number; // 0–1
  contribution: number; // fit × weight
};

export type Recommendation = {
  main: ProviderMeal;
  side: ProviderMeal | null;
  items: ProviderMeal[];
  /** 匹配度 0–100（五轴加权拟合值） */
  matchScore: number;
  /** 快乐值 0–100 */
  happiness: number;
  /** 主要驱动轴（Top 2），用于解释推荐理由 */
  drivers: AxisScore[];
  reason: string;
  pricing: {
    ceiling: number;
    original: number;
    coupon: ProviderCoupon | null;
    payable: number;
    saved: number;
    nextCoupon: ProviderCoupon | null;
    /** 距离下一张券还差多少元 */
    gapToNext: number;
    /** 凑单是否真的划算（多花的钱 < 多省的券） */
    toppingUpWorthIt: boolean;
  };
  budgetTip: string;
  /**
   * 预算外的更优选择提示。
   *
   * 例：¥35 预算下选不到 ¥40 的巨无霸套餐，但它的契合度其实更高——
   * 把这个事实说出来，比默默给一个次优结果更有用。
   */
  upgradeHint: string | null;
  alternatives: ProviderMeal[];
};

/** 由作答推导预算上限（直接映射第 2 题的选项 id，避免解析展示字符串） */
export function budgetCeilingOf(answers: Answers | null): number {
  if (!answers) return DEFAULT_BUDGET_CEILING;
  return BUDGET_CEILING[answers["q2"]] ?? DEFAULT_BUDGET_CEILING;
}

/**
 * 由画像推导三种口味取向。
 *
 * 三者之和恒为 1，构成一个凸组合，因此口味拟合度天然落在 0–1：
 *   辣味取向 = 口味偏刺激 × 恢复方式偏激活
 *   甜味取向 = 口味偏刺激 × 恢复方式偏安抚
 *   经典取向 = 口味偏清淡
 */
function tastePreferences(vector: PersonaVector) {
  return {
    spicy: vector.taste * (1 - vector.recovery),
    sweet: vector.taste * vector.recovery,
    classic: 1 - vector.taste,
  };
}

/** 套餐组合的聚合画像：各轴取最大值，价格取合计 */
function comboProfile(items: readonly ProviderMeal[]) {
  const max = (pick: (m: ProviderMeal) => number) => Math.max(...items.map(pick));

  return {
    spice: max((m) => m.spice),
    sweet: max((m) => m.sweet),
    caffeine: max((m) => m.caffeine),
    filling: max((m) => m.filling),
    shareable: max((m) => m.shareable),
    price: items.reduce((sum, m) => sum + m.price, 0),
  };
}

/**
 * 恢复方式拟合度。
 *
 * 不能写成「越甜越好」——那会让辣味人格也被推甜品。
 * 正确做法是把套餐的恢复取向与人格取向做**匹配**：
 *   - 套餐既无咖啡因也无甜度（纯咸香主餐）→ 中性 0.5，不奖励也不惩罚
 *   - 否则取向 = 甜度 / (咖啡因 + 甜度)，再与人格的 recovery 求接近程度
 */
function recoveryFitOf(
  combo: ReturnType<typeof comboProfile>,
  vector: PersonaVector
): number {
  const signal = combo.caffeine + combo.sweet;
  if (signal <= 0.001) return 0.5;

  const comboRecovery = combo.sweet / signal;
  return 1 - Math.abs(comboRecovery - vector.recovery);
}

/** 对套餐组合打分：五个匹配轴各自 0–1，再按权重加权求和 */
function scoreCombo(
  items: readonly ProviderMeal[],
  vector: PersonaVector,
  minPrice: number,
  maxPrice: number
): { score: number; axes: AxisScore[] } {
  const combo = comboProfile(items);
  const pref = tastePreferences(vector);

  // 价格归一化：以**全菜单**的价格区间为基准。
  // 若以预算上限为基准，候选价格会挤在 0.86–1.0，价格轴等于失效。
  const priceNorm = Math.max(
    0,
    Math.min(1, (combo.price - minPrice) / Math.max(1, maxPrice - minPrice))
  );

  const fits: Record<string, number> = {
    // 口味：三种取向的凸组合
    taste:
      pref.spicy * combo.spice +
      pref.sweet * combo.sweet +
      pref.classic * (1 - Math.max(combo.spice, combo.sweet)),
    // 恢复：取向匹配（不是越甜越好）
    recovery: recoveryFitOf(combo, vector),
    // 快乐需求：把人格的 0–1 需求重映射到主餐实际的 0.5–1.0 分量区间，
    // 否则低需求人格（0.4）永远匹配不上任何主餐，只能被同一个结果吸走。
    filling: 1 - Math.abs(combo.filling - (0.5 + vector.happiness_need * 0.5)),
    // 消费态度：越高越不在乎价格，越低越偏好便宜
    price: vector.spending * priceNorm + (1 - vector.spending) * (1 - priceNorm),
    // 社交：独食 vs 可分享
    social:
      vector.social * combo.shareable + (1 - vector.social) * (1 - combo.shareable),
  };

  const axes: AxisScore[] = Object.entries(fits).map(([key, fit]) => ({
    key,
    label: AXIS_LABEL[key],
    dimension: AXIS_DIMENSION[key],
    fit,
    contribution: fit * WEIGHTS[key],
  }));

  return { score: axes.reduce((sum, a) => sum + a.contribution, 0), axes };
}

type Combo = { items: ProviderMeal[]; score: number; axes: AxisScore[] };

/**
 * 枚举「主餐 ×（不加搭配 | 装得下的搭配）」的全部组合并按契合度排序。
 *
 * 抽成独立函数是为了让「受预算约束的最优」与「不受约束的最优」
 * 能用同一口径比较——否则会拿单个餐品去比一个组合，结论不可靠。
 */
function enumerateCombos(
  mains: readonly ProviderMeal[],
  sides: readonly ProviderMeal[],
  ceiling: number,
  vector: PersonaVector,
  minPrice: number,
  maxPrice: number
): Combo[] {
  const combos: Combo[] = [];

  for (const main of mains) {
    const remaining = ceiling - main.price;
    const options: ProviderMeal[][] = [[main]];
    for (const side of sides) {
      if (side.price <= remaining) options.push([main, side]);
    }
    for (const items of options) {
      const { score, axes } = scoreCombo(items, vector, minPrice, maxPrice);
      combos.push({ items, score, axes });
    }
  }

  return combos.sort((a, b) => b.score - a.score);
}

/** 适用且优惠最大的券 */
function bestCoupon(
  total: number,
  coupons: readonly ProviderCoupon[]
): ProviderCoupon | null {
  return (
    coupons
      .filter((c) => total >= c.threshold)
      .sort((a, b) => b.discount - a.discount)[0] ?? null
  );
}

/** 尚未达到、门槛最低的下一张券 */
function nextCoupon(
  total: number,
  coupons: readonly ProviderCoupon[]
): ProviderCoupon | null {
  return (
    coupons
      .filter((c) => total < c.threshold)
      .sort((a, b) => a.threshold - b.threshold)[0] ?? null
  );
}

function buildBudgetTip(
  vector: PersonaVector,
  pricing: Recommendation["pricing"]
): string {
  const { gapToNext, nextCoupon: next, toppingUpWorthIt } = pricing;

  if (next && gapToNext > 0 && gapToNext <= 15) {
    const netGain = next.discount - gapToNext;
    if (toppingUpWorthIt) {
      return `再点 ¥${gapToNext} 就能用「${next.name}」，券比多花的钱多 ¥${netGain} —— 值得凑。`;
    }
    return `距离「${next.name}」还差 ¥${gapToNext}，但多花的钱超过优惠，不建议为了凑单加餐。`;
  }

  if (vector.spending < 0.35) {
    return "你是精算型：先领券再点单，满减是这类画像的主场。";
  }
  if (vector.spending > 0.65) {
    return "你是体验优先型：今天不必卡太紧，选真正想吃的。";
  }
  return "预算处在中位区间：先看券再用券，通常能再省一档。";
}

/**
 * 主入口：生成今日推荐。
 *
 * @param data 菜单与优惠券。来自 `lib/provider`，缺席时回退到本地演示数据。
 */
export function recommend(
  persona: Persona,
  vector: PersonaVector,
  ceiling: number,
  data: RecommendData = FALLBACK_DATA
): Recommendation {
  const meals = data.meals.length > 0 ? data.meals : FALLBACK_DATA.meals;
  const coupons = data.coupons;

  const prices = meals.map((m) => m.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // 1. 硬约束：预算内的主餐
  const allMains = meals.filter((m) => m.category === "套餐");
  const affordable = allMains.filter((m) => m.price <= ceiling);
  const mainPool =
    affordable.length > 0 ? affordable : meals.filter((m) => m.price <= ceiling);
  const safeMains =
    mainPool.length > 0 ? mainPool : [meals[meals.length - 1]];

  const sides = meals.filter((m) => m.category !== "套餐");

  // 2. 枚举组合并取最优
  const combos = enumerateCombos(
    safeMains,
    sides,
    ceiling,
    vector,
    minPrice,
    maxPrice
  );
  const best = combos[0];

  const main = best.items[0];
  const side = best.items[1] ?? null;
  const items = best.items;

  // 3. 同主餐、不同搭配的组合作为备选
  const alternatives = combos
    .filter((c) => c.items[0].code !== main.code)
    .filter(
      (c, i, arr) =>
        arr.findIndex((x) => x.items[0].code === c.items[0].code) === i
    )
    .slice(0, 2)
    .map((c) => c.items[0]);

  // 4. 优惠模拟
  const original = items.reduce((sum, m) => sum + m.price, 0);
  const coupon = bestCoupon(original, coupons);
  const saved = coupon?.discount ?? 0;
  const payable = Math.max(0, original - saved);

  const upcoming = nextCoupon(original, coupons);
  const gapToNext = upcoming ? upcoming.threshold - original : 0;

  const pricing: Recommendation["pricing"] = {
    ceiling,
    original,
    coupon,
    payable,
    saved,
    nextCoupon: upcoming,
    gapToNext,
    toppingUpWorthIt: Boolean(upcoming && upcoming.discount - gapToNext > 0),
  };

  // 5. 预算外是否有更贴合的选择（同口径：都用「最优组合」比较）
  const unconstrained = enumerateCombos(
    allMains,
    sides,
    Number.POSITIVE_INFINITY,
    vector,
    minPrice,
    maxPrice
  )[0];

  const unconstrainedTotal = unconstrained.items.reduce(
    (s, m) => s + m.price,
    0
  );
  const differs = unconstrained.items[0].code !== main.code;
  // 只在差价合理时提示，避免对低预算用户推销远超预算的选项
  const withinReach = unconstrainedTotal <= ceiling + 15;

  const upgradeHint =
    differs && withinReach && unconstrained.score > best.score + 0.01
      ? `如果把预算放宽到 ¥${unconstrainedTotal}，「${unconstrained.items
          .map((m) => m.name)
          .join(" + ")}」会更贴合你` +
        `（契合度 ${Math.round(unconstrained.score * 100)}%，当前 ${Math.round(
          best.score * 100
        )}%）。`
      : null;

  // 6. 解释：驱动轴取自组合，而不是只看主餐
  const drivers = [...best.axes]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  const reason =
    `${persona.reasons}。` +
    `按你的六维画像，这套在「${drivers[0].label}」与「${drivers[1].label}」上最贴合。`;

  const axisFit = (key: string) => best.axes.find((a) => a.key === key)?.fit ?? 0;
  const happiness = Math.round(
    (axisFit("taste") * 0.4 +
      axisFit("filling") * 0.4 +
      (saved > 0 ? 1 : 0) * 0.2) *
      100
  );

  return {
    main,
    side,
    items,
    matchScore: Math.round(best.score * 100),
    happiness,
    drivers,
    reason,
    pricing,
    budgetTip: buildBudgetTip(vector, pricing),
    upgradeHint,
    alternatives,
  };
}
