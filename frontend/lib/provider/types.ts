/**
 * 推荐数据 Provider 的接口契约（Step 2a）。
 *
 * 这一层存在的唯一目的：**让页面不关心数据从哪来**。
 *
 *   现在：LocalMockProvider  → 直接读 frontend/data/mockRecommendation.ts
 *   将来：HttpProvider       → fetch('/api/recommend/*') → backend → MCP Adapter → 麦当劳 MCP
 *
 * 页面只依赖本文件里的接口类型，因此替换数据源时页面与推荐引擎都不需要修改。
 *
 * ⚠️ MCP Token 永远不会出现在这里——它只存在于 backend 的环境变量中。
 */

/** 数据来源标识。前端据此显示「演示数据 / 实时数据」徽标，绝不把 Mock 伪装成真实数据。 */
export type DataSource = "mock" | "mcp";

/**
 * 餐品。
 *
 * 字段刻意与麦当劳 MCP 的 `query-meals` 返回形态对齐；
 * 后五个匹配轴在真实数据中由「标签 + 营养」推导（见 backend/mcp/normalize.py），
 * 此处由 Provider 统一提供，页面无需感知差异。
 */
export type ProviderMeal = {
  code: string;
  name: string;
  /** 单价（元） */
  price: number;
  kcal: number;
  category: "套餐" | "小食" | "饮品" | "甜品";
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

/** 优惠券，对应 MCP 的 `query-store-coupons`。 */
export type ProviderCoupon = {
  id: string;
  name: string;
  threshold: number;
  discount: number;
};

/** 营养数据，对应 MCP 的 `list-nutrition-foods`。本期不由页面直接消费。 */
export type ProviderNutrition = {
  code: string;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carbohydrate_g: number;
  sodium_mg: number;
};

/** 一次推荐所需的完整数据上下文。 */
export type RecommendContext = {
  meals: ProviderMeal[];
  coupons: ProviderCoupon[];
  /** 数据来源 —— 用于 UI 诚实标注 */
  source: DataSource;
  /** 数据获取时间（ISO 字符串） */
  fetchedAt: string;
};

/** 购物车条目，用于价格计算。 */
export type CartItem = {
  code: string;
  qty: number;
};

/**
 * 价格计算结果。
 *
 * 对应 MCP 的 `calculate-price`——**这是唯一的权威价格来源**，
 * 推荐引擎自身不做金额估算。
 */
export type PriceQuote = {
  original: number;
  coupon: ProviderCoupon | null;
  payable: number;
  saved: number;
  source: DataSource;
};

/**
 * Provider 接口。
 *
 * 这是页面与数据源之间**唯一的接缝**。
 */
export interface RecommendDataProvider {
  /** 内部标识，用于日志 */
  readonly id: string;
  /** 面向用户的可读名称，用于数据来源提示 */
  readonly label: string;
  /** 拉取推荐所需的菜单与优惠券 */
  getContext(): Promise<RecommendContext>;
  /** 计算价格（对应 MCP calculate-price） */
  calculate(items: CartItem[]): Promise<PriceQuote>;
}
