/**
 * 后端接口封装。
 *
 * Phase 2 只有一个用途：验证「Next.js → FastAPI」这条链路已经打通，
 * 首页右上角的运行模式徽标就是靠它取数的。
 */

export type RuntimeInfo = {
  name: string;
  version: string;
  mode: string;
  llm: string;
  mcp: string;
};

/**
 * API 根地址。
 *
 * 默认空字符串 = 同源访问。正式形态下页面由 FastAPI(:8000) 托管，因此无需配置。
 * 仅当使用 `next dev`(:3000) 单独调试前端时，才需要设置
 * NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000（后端已配置对应 CORS）。
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

/** 读取后端运行时信息。失败时抛错，由调用方决定降级展示。 */
export async function fetchRuntimeInfo(): Promise<RuntimeInfo> {
  const res = await fetch(`${API_BASE}/api`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as RuntimeInfo;
}
