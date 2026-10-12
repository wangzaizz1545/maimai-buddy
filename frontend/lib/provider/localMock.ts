/**
 * 本地 Mock Provider（离线兜底）。
 *
 * 直接消费 frontend/data/mockRecommendation.ts 里已有的演示数据——
 * 这份数据在接入 MCP 之后**不会删除**，而是作为后端不可用时的降级路径，
 * 保证页面在纯离线环境下依然完整可用。
 */

import {
  MOCK_COUPONS,
  MOCK_MEALS,
  type MockCoupon,
  type MockMeal,
} from "@/data/mockRecommendation";
import { filterMockStores } from "@/data/mockStores";
import type {
  CartItem,
  PriceQuote,
  ProviderStore,
  RecommendContext,
  RecommendDataProvider,
  StoreSearchResult,
} from "./types";

/** 适用且优惠最大的券（与 backend/mcp/mock_provider.py 的 best_coupon 规则保持一致） */
function bestCoupon(total: number, coupons: MockCoupon[]): MockCoupon | null {
  return (
    coupons
      .filter((c) => total >= c.threshold)
      .sort((a, b) => b.discount - a.discount)[0] ?? null
  );
}

/** 已选门店的展示名缓存：本地 Mock 没有按门店区分的菜单，仅用于卡片显示 */
let lastSelected: ProviderStore | null = null;

export const localMockProvider: RecommendDataProvider = {
  id: "local-mock",
  label: "本地演示数据",

  async getContext(): Promise<RecommendContext> {
    // MockMeal 与 ProviderMeal 结构一致，可直接赋值（TS 结构化类型）
    //
    // 注意：本地降级路径**不区分门店**——演示数据只有一份菜单。
    // 用户选择的门店编码会照常发给后端，但后端不可用时拿不到门店菜单，
    // 这是降级路径的固有边界，页面的 source 徽标会如实标注为「演示数据」。
    return {
      meals: MOCK_MEALS as MockMeal[],
      coupons: MOCK_COUPONS,
      source: "mock",
      fetchedAt: new Date().toISOString(),
    };
  },

  async calculate(items: CartItem[]): Promise<PriceQuote> {
    const original = items.reduce((sum, item) => {
      const meal = MOCK_MEALS.find((m) => m.code === item.code);
      return sum + (meal ? meal.price * item.qty : 0);
    }, 0);

    const coupon = bestCoupon(original, MOCK_COUPONS);
    const saved = coupon?.discount ?? 0;

    return {
      original,
      coupon,
      payable: Math.max(0, original - saved),
      saved,
      source: "mock",
    };
  },

  async searchStores(city: string, keyword: string): Promise<StoreSearchResult> {
    return {
      stores: filterMockStores(city, keyword),
      source: "mock",
      fetchedAt: new Date().toISOString(),
      city: city.trim(),
      keyword: keyword.trim(),
      mode: city.trim() && keyword.trim() ? "search" : "favorites",
    };
  },
};

/** 供页面在本地降级路径下展示「当前门店」（后端不可用时没有门店上下文） */
export function rememberLocalStore(store: ProviderStore | null): void {
  lastSelected = store;
}

export function getLocalStore(): ProviderStore | null {
  return lastSelected;
}
