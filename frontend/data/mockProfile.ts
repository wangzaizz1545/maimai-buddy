import type { AnswerContext, BuddyProfile, MemoryItem } from "@/lib/types";
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";

/**
 * 麦友档案的展示数据（Phase 3 使用 Mock）。
 *
 * Phase 5 接入 Memory 系统后，这里会被真实的分层记忆替换。
 * 当前实现只是为了把「AI 记得你」这个产品主张在 UI 上立起来。
 */

/** 每种人格对应的「AI 记得你的 3 件事」 */
export const MEMORIES_BY_PERSONA: Record<string, MemoryItem[]> = {
  comfort_fries: [
    { id: "m1", icon: "🌙", text: "你常在情绪不太稳的那天出现" },
    { id: "m2", icon: "🍟", text: "十次里有七次点了薯条" },
    { id: "m3", icon: "🥤", text: "你说过「老样子就好」" },
  ],
  coffee_survivor: [
    { id: "m1", icon: "⏰", text: "你的第一单通常在 9 点之前" },
    { id: "m2", icon: "☕", text: "冰美式是你的固定搭配" },
    { id: "m3", icon: "😮‍💨", text: "你常说自己「今天有点撑不住」" },
  ],
  big_mac_master: [
    { id: "m1", icon: "🍔", text: "你几乎没换过主餐" },
    { id: "m2", icon: "💪", text: "你偏好大份，很少点小食" },
    { id: "m3", icon: "📅", text: "发薪日那几天你来得最勤" },
  ],
  spicy_explorer: [
    { id: "m1", icon: "🌶", text: "你每次都问「有没有更辣的」" },
    { id: "m2", icon: "🚀", text: "新品上线当天你就来了" },
    { id: "m3", icon: "🔁", text: "你几乎没有点过重复的搭配" },
  ],
  dessert_healer: [
    { id: "m1", icon: "🍦", text: "你很少跳过甜品" },
    { id: "m2", icon: "💗", text: "心情差的那天你点了双份甜筒" },
    { id: "m3", icon: "🌙", text: "你说过「甜一点就好了」" },
  ],
  budget_master: [
    { id: "m1", icon: "🎟", text: "你下单前平均会看 3 张券" },
    { id: "m2", icon: "🧮", text: "你为凑单改过两次订单" },
    { id: "m3", icon: "✨", text: "你从没按原价买过" },
  ],
  share_player: [
    { id: "m1", icon: "👥", text: "你的订单里经常有 3 份以上主食" },
    { id: "m2", icon: "🎉", text: "你常在周五晚上出现" },
    { id: "m3", icon: "💬", text: "你点单前总会先问「你们想吃什么」" },
  ],
  night_coder: [
    { id: "m1", icon: "🌙", text: "你总在 22:00 之后出现" },
    { id: "m2", icon: "🌶", text: "上一次你说「辣一下才清醒」" },
    { id: "m3", icon: "🍟", text: "你常把一餐当成一次重启" },
  ],
};

/** 默认档案（对应示例人格：深夜代码战士） */
export const MOCK_PROFILE: BuddyProfile = {
  nickname: "夜猫子",
  personaCode: DEFAULT_PERSONA.code,
  taste: { label: "辣味", level: 4 },
  budget: "30–50",
  scene: "夜间回血",
  memories: MEMORIES_BY_PERSONA[DEFAULT_PERSONA.code] ?? [],
};

/**
 * 根据人格与作答上下文拼装档案数据。
 *
 * 这是 Mock 层的组装函数：人格决定「AI 记得你的 3 件事」，
 * 作答决定预算与场景，口味暂时用默认值（Phase 5 会由真实数据推导）。
 */
export function buildProfile(
  personaCode: string | undefined,
  ctx?: Partial<AnswerContext> & { tasteLabel?: string; tasteLevel?: number }
): BuddyProfile {
  const persona = getPersona(personaCode) ?? DEFAULT_PERSONA;

  return {
    nickname: MOCK_PROFILE.nickname,
    personaCode: persona.code,
    taste: {
      label: ctx?.tasteLabel ?? MOCK_PROFILE.taste.label,
      level: ctx?.tasteLevel ?? MOCK_PROFILE.taste.level,
    },
    budget: ctx?.budget ?? MOCK_PROFILE.budget,
    scene: ctx?.scene ?? MOCK_PROFILE.scene,
    memories: MEMORIES_BY_PERSONA[persona.code] ?? MOCK_PROFILE.memories,
  };
}
