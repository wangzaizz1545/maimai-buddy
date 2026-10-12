import type { DimensionMeta, Question, QuestionOption } from "@/lib/types";

/**
 * 六个维度的元信息。顺序即雷达图的绘制顺序。
 */
export const DIMENSIONS: DimensionMeta[] = [
  { key: "happiness_need", label: "快乐需求", short: "快乐" },
  { key: "spending", label: "消费态度", short: "消费" },
  { key: "taste", label: "口味偏好", short: "口味" },
  { key: "adventure", label: "冒险程度", short: "冒险" },
  { key: "social", label: "社交属性", short: "社交" },
  { key: "recovery", label: "恢复方式", short: "恢复" },
];

/**
 * 麦门人格测试题。
 *
 * 设计要点：
 * 1. 一题恰好驱动一个维度（共 6 题 ↔ 6 维），因此结果页可以解释
 *    「你的某一维来自第几题」，而不是给出一堆无法追溯的数字。
 * 2. 选项直接携带维度取值（0–1），而非增量，避免多题叠加时的归一化歧义。
 * 3. 部分选项带 spillover，对相邻维度产生次级影响，让画像更有层次。
 */
export const QUESTIONS: Question[] = [
  {
    id: "q1",
    dimension: "happiness_need",
    title: "现在的你，最像哪一个？",
    subtitle: "凭第一感觉选，别想太久",
    columns: 2,
    options: [
      { id: "q1_plain", emoji: "😐", label: "就是常规一餐", value: 0.25 },
      { id: "q1_good", emoji: "😎", label: "心情不错，想吃点好的", value: 0.55 },
      { id: "q1_tired", emoji: "😵", label: "累到不想思考", value: 0.85 },
      {
        id: "q1_reward",
        emoji: "🔥",
        label: "想狠狠奖励自己",
        value: 0.95,
        spillover: { spending: 0.75 },
      },
    ],
  },
  {
    id: "q2",
    dimension: "spending",
    title: "这顿的预算是？",
    subtitle: "不评判，只影响推荐",
    columns: 2,
    options: [
      { id: "q2_low", emoji: "💰", label: "20 以内", value: 0.1, tags: { budget: "20 以内" } },
      { id: "q2_mid", emoji: "🧾", label: "20–35", value: 0.4, tags: { budget: "20–35" } },
      { id: "q2_high", emoji: "💳", label: "35–50", value: 0.7, tags: { budget: "35–50" } },
      {
        id: "q2_free",
        emoji: "🎉",
        label: "不限，开心最重要",
        value: 1.0,
        tags: { budget: "不限" },
      },
    ],
  },
  {
    id: "q3",
    dimension: "social",
    title: "这顿是什么场合？",
    subtitle: "场景决定的不只是吃什么",
    columns: 3,
    options: [
      { id: "q3_breakfast", emoji: "🍳", label: "早餐", value: 0.1, tags: { scene: "早餐" } },
      { id: "q3_lunch", emoji: "🍱", label: "午餐", value: 0.25, tags: { scene: "午餐" } },
      {
        id: "q3_overtime",
        emoji: "💻",
        label: "加班",
        value: 0.2,
        spillover: { happiness_need: 0.8 },
        tags: { scene: "加班" },
      },
      {
        id: "q3_night",
        emoji: "🌙",
        label: "夜宵",
        value: 0.15,
        spillover: { recovery: 0.4 },
        tags: { scene: "夜宵" },
      },
      { id: "q3_date", emoji: "💕", label: "约会", value: 0.75, tags: { scene: "约会" } },
      {
        id: "q3_party",
        emoji: "🎊",
        label: "聚会",
        value: 1.0,
        spillover: { happiness_need: 0.85 },
        tags: { scene: "聚会" },
      },
    ],
  },
  {
    id: "q4",
    dimension: "taste",
    title: "翻开菜单，第一眼落在？",
    subtitle: "别纠正自己，第一眼就是答案",
    columns: 2,
    options: [
      { id: "q4_classic", emoji: "🍔", label: "经典汉堡，永远的神", value: 0.15 },
      {
        id: "q4_spicy",
        emoji: "🌶",
        label: "带辣的，越辣越好",
        value: 0.85,
        spillover: { adventure: 0.8 },
      },
      {
        id: "q4_sweet",
        emoji: "🍦",
        label: "甜品，甜的",
        value: 0.9,
        spillover: { recovery: 0.9 },
      },
      { id: "q4_light", emoji: "🥗", label: "清爽一点，别有负担", value: 0.35 },
    ],
  },
  {
    id: "q5",
    dimension: "adventure",
    title: "上了新品，你会？",
    subtitle: "诚实一点",
    columns: 2,
    options: [
      { id: "q5_now", emoji: "🚀", label: "立刻试，先点再说", value: 0.95 },
      { id: "q5_review", emoji: "🔍", label: "先看看别人评价", value: 0.6 },
      { id: "q5_classic", emoji: "🍟", label: "还是老几样最稳", value: 0.1 },
      {
        id: "q5_coupon",
        emoji: "🎟",
        label: "看有没有券，有就试",
        value: 0.5,
        spillover: { spending: 0.15 },
      },
    ],
  },
  {
    id: "q6",
    dimension: "recovery",
    title: "你怎么回血？",
    subtitle: "最后一题了",
    columns: 2,
    options: [
      {
        id: "q6_coffee",
        emoji: "☕",
        label: "一杯咖啡，续上",
        value: 0.1,
        spillover: { taste: 0.6 },
      },
      {
        id: "q6_sweet",
        emoji: "🍰",
        label: "来点甜的",
        value: 0.9,
        spillover: { taste: 0.9 },
      },
      {
        id: "q6_meat",
        emoji: "🍗",
        label: "大口吃肉，最踏实",
        value: 0.7,
        spillover: { taste: 0.35 },
      },
      {
        id: "q6_people",
        emoji: "👥",
        label: "找人一起吃才香",
        value: 0.5,
        spillover: { social: 1.0 },
      },
    ],
  },
];

/** 按 id 查找选项 */
export function findOption(
  questionId: string,
  optionId: string
): QuestionOption | undefined {
  return QUESTIONS.find((q) => q.id === questionId)?.options.find(
    (o) => o.id === optionId
  );
}

/** 按 id 查找题目 */
export function findQuestion(questionId: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === questionId);
}

/** 题目总数 */
export const QUESTION_COUNT = QUESTIONS.length;
