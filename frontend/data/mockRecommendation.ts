/**
 * 「麦友今日推荐」的演示数据。
 *
 * ⚠️ 本文件是 **Mock 数据**，不是真实菜单或真实价格。
 *
 * 设计原则：
 *   餐品编码（SP00x）与价格、热量 **刻意与 fixtures/meals.json 保持一致**，
 *   券也与 fixtures/coupons.json 对齐。这样将来接入麦当劳 MCP 时，
 *   只需把数据源换成真实的 query-meals / query-store-coupons / calculate-price 返回，
 *   推荐逻辑层不需要重写。
 *
 * 每个餐品额外带有用于匹配的画像轴（0–1），这些轴在真实 MCP 数据中
 * 将由「标签 + 营养数据」推导，此处直接标注以便演示。
 */

export type MealCategory = "套餐" | "小食" | "饮品" | "甜品";

export type MockMeal = {
  code: string;
  name: string;
  /** 单价（元） */
  price: number;
  kcal: number;
  category: MealCategory;
  tags: string[];
  /** 辣度 0–1 */
  spice: number;
  /** 甜度 0–1 */
  sweet: number;
  /** 咖啡因 0–1 */
  caffeine: number;
  /** 满足感 / 分量 0–1 */
  filling: number;
  /** 可分享程度 0–1 */
  shareable: number;
};

export type MockCoupon = {
  id: string;
  name: string;
  /** 使用门槛（元） */
  threshold: number;
  /** 优惠金额（元） */
  discount: number;
};

/** 演示菜单（与 fixtures/meals.json 同编码同价格） */
export const MOCK_MEALS: MockMeal[] = [
  {
    code: "SP001", name: "麦辣鸡腿堡套餐", price: 35, kcal: 780, category: "套餐",
    tags: ["辣", "招牌"], spice: 0.9, sweet: 0, caffeine: 0, filling: 0.7, shareable: 0.3,
  },
  {
    code: "SP002", name: "巨无霸套餐", price: 40, kcal: 920, category: "套餐",
    tags: ["经典", "牛肉"], spice: 0.1, sweet: 0, caffeine: 0, filling: 1.0, shareable: 0.4,
  },
  {
    code: "SP003", name: "双层吉士汉堡套餐", price: 30, kcal: 700, category: "套餐",
    tags: ["经典", "牛肉"], spice: 0, sweet: 0, caffeine: 0, filling: 0.8, shareable: 0.35,
  },
  {
    code: "SP004", name: "板烧鸡腿堡套餐", price: 33, kcal: 640, category: "套餐",
    tags: ["不辣", "鸡"], spice: 0, sweet: 0, caffeine: 0, filling: 0.7, shareable: 0.35,
  },
  {
    code: "SP011", name: "麦香鸡套餐", price: 25, kcal: 560, category: "套餐",
    tags: ["经典", "鸡"], spice: 0, sweet: 0, caffeine: 0, filling: 0.65, shareable: 0.35,
  },
  {
    code: "SP012", name: "吉士汉堡套餐", price: 21, kcal: 480, category: "套餐",
    tags: ["经典", "轻量"], spice: 0, sweet: 0, caffeine: 0, filling: 0.6, shareable: 0.3,
  },
  {
    code: "SP005", name: "薯条（大）", price: 14, kcal: 430, category: "小食",
    tags: ["经典", "素食"], spice: 0, sweet: 0, caffeine: 0, filling: 0.4, shareable: 0.8,
  },
  {
    code: "SP006", name: "麦辣鸡翅（2块）", price: 13, kcal: 260, category: "小食",
    tags: ["辣"], spice: 0.95, sweet: 0, caffeine: 0, filling: 0.3, shareable: 0.75,
  },
  {
    code: "SP007", name: "中杯冰美式", price: 15, kcal: 13, category: "饮品",
    tags: ["咖啡因", "无糖"], spice: 0, sweet: 0, caffeine: 1.0, filling: 0.1, shareable: 0.2,
  },
  {
    code: "SP008", name: "中杯可乐", price: 10, kcal: 180, category: "饮品",
    tags: ["含糖"], spice: 0, sweet: 0.6, caffeine: 0.2, filling: 0.15, shareable: 0.7,
  },
  {
    code: "SP009", name: "原味甜筒", price: 6, kcal: 200, category: "甜品",
    tags: ["甜", "安抚"], spice: 0, sweet: 1.0, caffeine: 0, filling: 0.15, shareable: 0.3,
  },
  {
    code: "SP010", name: "麦旋风（奥利奥）", price: 13, kcal: 320, category: "甜品",
    tags: ["甜", "安抚"], spice: 0, sweet: 0.95, caffeine: 0, filling: 0.3, shareable: 0.4,
  },
];

/** 演示优惠券（与 fixtures/coupons.json 对齐） */
export const MOCK_COUPONS: MockCoupon[] = [
  { id: "CP001", name: "满 30 减 7", threshold: 30, discount: 7 },
  { id: "CP002", name: "满 50 减 15", threshold: 50, discount: 15 },
];

/**
 * 预算档位 → 金额上限（元）。
 *
 * 直接由第 2 题的选项 id 映射，避免解析「20–35」这类展示字符串带来的脆弱性。
 */
export const BUDGET_CEILING: Record<string, number> = {
  q2_low: 20,
  q2_mid: 35,
  q2_high: 50,
  q2_free: 60,
};

/** 兜底上限（作答缺失时使用） */
export const DEFAULT_BUDGET_CEILING = 35;
