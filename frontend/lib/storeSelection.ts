/**
 * 已选门店的持久化层。
 *
 * 为什么单独成文件而不是加进 `lib/store.ts`：
 *   `store.ts` 是 v0.1 已验收并冻结的模块（人格 / 作答 / 档案三层状态），
 *   门店选择是 v0.3 新增的独立关注点。分开存放可以保持冻结模块零改动，
 *   也让门店状态的生命周期（换门店）与人格状态（重测）互不干扰。
 *
 * 与 `store.ts` 遵循同样的两条硬性规则：
 *   1. 读取必须 SSR 安全 —— 静态导出会预渲染，此时 window 不存在
 *   2. 页面中调用必须放在 useEffect 内，否则会 hydration mismatch
 */

import type { ProviderStore, SelectedStore } from "@/lib/provider/types";

export const STORE_SELECTION_KEY = "mcbuddy.v1.store";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 读取已选门店；没有选择或数据损坏时返回 null。 */
export function readSelectedStore(): SelectedStore | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORE_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedStore;
    // 结构校验：storeCode 是唯一必需的字段
    return parsed && typeof parsed.storeCode === "string" && parsed.storeCode
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** 保存用户选择的门店。 */
export function saveSelectedStore(store: ProviderStore): SelectedStore {
  const selected: SelectedStore = {
    storeCode: store.storeCode,
    storeName: store.storeName,
    address: store.address,
    selectedAt: new Date().toISOString(),
  };

  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORE_SELECTION_KEY, JSON.stringify(selected));
    } catch {
      /* 隐私模式或配额不足时静默失败，不影响页面继续用内存里的值 */
    }
  }

  return selected;
}

/** 清除已选门店（回到「使用收藏门店」）。 */
export function clearSelectedStore(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORE_SELECTION_KEY);
  } catch {
    /* noop */
  }
}
