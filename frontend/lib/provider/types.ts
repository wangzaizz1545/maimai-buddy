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

/**
 * 门店，对应 MCP 的 `query-nearby-stores`。
 *
 * ⚠️ 真实接口有两种模式，返回字段不同：
 *
 * | searchType | 参数 | `businessStatus` |
 * |---|---|---|
 * | 1（收藏门店） | 无 | `null`（不返回该字段） |
 * | 2（城市搜索） | city + keyword | `true` / `false` |
 *
 * 因此**必须区分「已打烊（false）」与「状态未知（null）」**，
 * 不能把 null 当成打烊——那是在编造数据。
 */
export type ProviderStore = {
  storeCode: string;
  storeName: string;
  address: string;
  /** 距离（米）。收藏门店返回 null */
  distance: number | null;
  /** 营业状态。null = 该搜索方式未返回此字段 */
  businessStatus: boolean | null;
  businessStartTime: string;
  businessEndTime: string;
  /** 今日可预约时段的可读文本 */
  hoursText: string;
  /** 是否支持预约 */
  reservation: boolean;
};

/** 门店搜索结果。 */
export type StoreSearchResult = {
  stores: ProviderStore[];
  source: DataSource;
  fetchedAt: string;
  city: string;
  keyword: string;
  /** favorites = 收藏门店；search = 城市 + 关键词 */
  mode: "favorites" | "search";
};

/** 用户已选中的门店。持久化到 localStorage。 */
export type SelectedStore = {
  storeCode: string;
  storeName: string;
  address: string;
  /** 选择时的时间戳（ISO） */
  selectedAt: string;
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
  /**
   * 拉取推荐所需的菜单与优惠券。
   *
   * @param storeCode 用户在 /store 页选中的门店编码。
   *                  留空时由后端回退到收藏门店。
   */
  getContext(storeCode?: string): Promise<RecommendContext>;
  /** 计算价格（对应 MCP calculate-price） */
  calculate(items: CartItem[], storeCode?: string): Promise<PriceQuote>;
  /**
   * 搜索门店（对应 MCP query-nearby-stores）。
   *
   * city 与 keyword 在真实模式下**必须同时提供**；都留空则返回收藏门店。
   */
  searchStores(city: string, keyword: string): Promise<StoreSearchResult>;
}
