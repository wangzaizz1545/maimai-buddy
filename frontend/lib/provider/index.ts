/**
 * Provider 门面（Step 2b）。
 *
 * 页面只需要调用这里，不需要知道数据来自后端还是本地。
 *
 * 策略（按确认的方案）：**HTTP 优先 + Mock 兜底**
 *
 *   MCBUDDY_MCP=live    → backend → MCP Adapter → 麦当劳 MCP
 *   MCBUDDY_MCP=fixture → backend 返回 fixtures 数据
 *   后端不可用 / 超时     → 前端自动降级到本地 Mock，页面照常可用
 *
 * 注意 `source` 与「用的是哪个 Provider」是两件事：
 *   后端自身也可能处于 fixture 模式并返回 source="mock"，
 *   此时仍然应该由后端来算价（保证链路一致），而不是前端自己算。
 *   因此本模块返回 `provider` 字段，由页面用同一个 Provider 继续调用 calculate。
 */

import { httpProvider } from "./http";
import { localMockProvider } from "./localMock";
import type { RecommendContext, RecommendDataProvider } from "./types";

export type LoadedContext = {
  context: RecommendContext;
  /** 实际提供数据的 Provider —— 后续 calculate 应继续使用它 */
  provider: RecommendDataProvider;
  /** 是否发生了降级（HTTP 不可用，回落到本地 Mock） */
  degraded: boolean;
};

/** 允许强制使用本地数据（离线调试用）：NEXT_PUBLIC_DATA_SOURCE=local */
const FORCE_LOCAL = process.env.NEXT_PUBLIC_DATA_SOURCE === "local";

/** 拉取推荐上下文：HTTP 优先，失败自动降级 */
export async function loadRecommendContext(): Promise<LoadedContext> {
  if (FORCE_LOCAL) {
    return {
      context: await localMockProvider.getContext(),
      provider: localMockProvider,
      degraded: true,
    };
  }

  try {
    const context = await httpProvider.getContext();
    return { context, provider: httpProvider, degraded: false };
  } catch {
    // 后端未启动、超时或返回非 2xx —— 全部降级，绝不打断页面
    return {
      context: await localMockProvider.getContext(),
      provider: localMockProvider,
      degraded: true,
    };
  }
}

export { localMockProvider, httpProvider };
export type {
  CartItem,
  DataSource,
  PriceQuote,
  ProviderCoupon,
  ProviderMeal,
  ProviderNutrition,
  RecommendContext,
  RecommendDataProvider,
} from "./types";
