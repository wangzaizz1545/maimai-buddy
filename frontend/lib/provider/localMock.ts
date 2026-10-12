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
import type {
  CartItem,
  PriceQuote,
  RecommendContext,
  RecommendDataProvider,
} from "./types";

/** 适用且优惠最大的券（与 backend/mcp/mock_provider.py 的 best_coupon 规则保持一致） */
function bestCoupon(total: number, coupons: MockCoupon[]): MockCoupon | null {
  return (
    coupons
      .filter((c) => total >= c.threshold)
      .sort((a, b) => b.discount - a.discount)[0] ?? null
  );
}

export const localMockProvider: RecommendDataProvider = {
  id: "local-mock",
  label: "本地演示数据",

  async getContext(): Promise<RecommendContext> {
    // MockMeal 与 ProviderMeal 结构一致，可直接赋值（TS 结构化类型）
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
};
