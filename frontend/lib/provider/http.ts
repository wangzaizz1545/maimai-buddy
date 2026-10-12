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
  StoreSearchResult,
} from "./types";

/** 与 lib/api.ts 保持一致的约定：默认同源访问 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 单次请求超时（毫秒）——超时即降级到本地 Mock */
const TIMEOUT_MS = 4000;

/**
 * 门店搜索的超时。
 *
 * 比普通请求更长：后端要先向麦当劳 MCP 发起一次真实往返，
 * 4 秒在弱网下容易误判为失败。
 */
const SEARCH_TIMEOUT_MS = 12000;

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // 400 是后端对「城市与关键词只给了一个」的明确校验，把原因带出来
      if (res.status === 400) {
        try {
          const body = (await res.json()) as { detail?: string };
          if (body.detail) throw new Error(body.detail);
        } catch (err) {
          if (err instanceof Error && err.message) throw err;
        }
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** 把门店编码拼成查询串；未选择门店时返回空串（后端回退到收藏门店） */
function storeQuery(storeCode?: string): string {
  return storeCode ? `?storeCode=${encodeURIComponent(storeCode)}` : "";
}

export const httpProvider: RecommendDataProvider = {
  id: "http",
  label: "后端实时数据",

  async getContext(storeCode?: string): Promise<RecommendContext> {
    const query = storeQuery(storeCode);

    const [menu, promotions] = await Promise.all([
      request<{ meals: ProviderMeal[]; source: RecommendContext["source"]; fetchedAt: string }>(
        `/api/recommend/menu${query}`
      ),
      request<{ coupons: ProviderCoupon[] }>(`/api/recommend/promotions${query}`),
    ]);

    return {
      meals: menu.meals,
      coupons: promotions.coupons,
      source: menu.source,
      fetchedAt: menu.fetchedAt,
    };
  },

  async calculate(items: CartItem[], storeCode?: string): Promise<PriceQuote> {
    return request<PriceQuote>(`/api/recommend/calculate${storeQuery(storeCode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  },

  async searchStores(city: string, keyword: string): Promise<StoreSearchResult> {
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (keyword.trim()) params.set("keyword", keyword.trim());
    const query = params.toString();

    return request<StoreSearchResult>(
      `/api/store/search${query ? `?${query}` : ""}`,
      undefined,
      SEARCH_TIMEOUT_MS
    );
  },
};
