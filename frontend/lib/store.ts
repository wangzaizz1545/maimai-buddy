import type { Answers, BuddyProfile, PersonaResult } from "@/lib/types";

/**
 * localStorage 持久化层。
 *
 * 为什么需要它：
 *   项目使用 Next.js 静态导出，页面之间是真实的导航。React Context 在
 *   刷新或直接访问 URL 时会丢失，因此跨页状态必须落到 localStorage。
 *
 * 两条硬性规则：
 *   1. 所有读取函数必须 SSR 安全 —— 静态导出会做预渲染，
 *      此时 window 不存在，必须返回 null 而不是抛错。
 *   2. 页面中调用读取函数必须放在 useEffect 内。若在渲染期直接读取，
 *      服务端预渲染（无数据）与客户端首次渲染（有数据）的 HTML 不一致，
 *      React 会报 hydration mismatch。
 */

export const STORAGE_KEYS = {
  answers: "mcbuddy.v1.answers",
  persona: "mcbuddy.v1.persona",
  profile: "mcbuddy.v1.profile",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJSON<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // 数据损坏时静默降级，绝不让页面崩溃
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隐私模式或配额不足时静默失败
  }
}

function removeKey(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// 作答
// ---------------------------------------------------------------------------
export function readAnswers(): Answers | null {
  return readJSON<Answers>(STORAGE_KEYS.answers);
}

export function saveAnswers(answers: Answers): void {
  writeJSON(STORAGE_KEYS.answers, answers);
}

// ---------------------------------------------------------------------------
// 人格结果
// ---------------------------------------------------------------------------
export function readPersona(): PersonaResult | null {
  return readJSON<PersonaResult>(STORAGE_KEYS.persona);
}

export function savePersona(persona: PersonaResult): void {
  writeJSON(STORAGE_KEYS.persona, persona);
}

// ---------------------------------------------------------------------------
// 麦友档案
// ---------------------------------------------------------------------------
export function readProfile(): BuddyProfile | null {
  return readJSON<BuddyProfile>(STORAGE_KEYS.profile);
}

export function saveProfile(profile: BuddyProfile): void {
  writeJSON(STORAGE_KEYS.profile, profile);
}

// ---------------------------------------------------------------------------
// 重置
// ---------------------------------------------------------------------------
export function resetAll(): void {
  removeKey(STORAGE_KEYS.answers);
  removeKey(STORAGE_KEYS.persona);
  removeKey(STORAGE_KEYS.profile);
}
