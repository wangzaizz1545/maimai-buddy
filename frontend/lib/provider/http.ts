/**
 * HTTP Provider —— 经后端 API 取数。
 *
 * 数据链路：
 *   浏览器 → FastAPI /api/recommend/* → backend/mcp/ Adapter → 麦当劳 MCP
 *
 * 关键安全约束：**Token 只存在于后端环境变量**，
 * 本文件与任何前端产物都不包含、也不接收任何凭证。
 *
 * 同源部署（FastAPI 同时托管前端与 API），因此默认不需要配置 base URL。
 */

import type {
  CartItem,
  PriceQuote,
  ProviderCoupon,
  ProviderMeal,
  RecommendContext,
  RecommendDataProvider,
} from "./types";

/** 与 lib/api.ts 保持一致的约定：默认同源访问 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 单次请求超时（毫秒）——超时即降级到本地 Mock */
const TIMEOUT_MS = 4000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const httpProvider: RecommendDataProvider = {
  id: "http",
  label: "后端实时数据",

  async getContext(): Promise<RecommendContext> {
    const [menu, promotions] = await Promise.all([
      request<{ meals: ProviderMeal[]; source: RecommendContext["source"]; fetchedAt: string }>(
        "/api/recommend/menu"
      ),
      request<{ coupons: ProviderCoupon[] }>("/api/recommend/promotions"),
    ]);

    return {
      meals: menu.meals,
      coupons: promotions.coupons,
      source: menu.source,
      fetchedAt: menu.fetchedAt,
    };
  },

  async calculate(items: CartItem[]): Promise<PriceQuote> {
    return request<PriceQuote>("/api/recommend/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  },
};
