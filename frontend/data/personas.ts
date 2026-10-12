import type { Persona } from "@/lib/types";

/**
 * 八种麦门人格原型。
 *
 * vector 为六维原型向量，顺序与 DIMENSIONS 一致：
 *   快乐需求 / 消费态度 / 口味偏好 / 冒险程度 / 社交属性 / 恢复方式
 *
 * 文案基调：准得让人想反驳，而不是赞美。
 */
export const PERSONAS: Persona[] = [
  {
    code: "comfort_fries",
    emoji: "🍟",
    name: "黄金薯条治愈者",
    tagline: "一份薯条，能把今天按回原位。",
    description:
      "你不是对食物挑剔，你只是需要一个熟悉的、确定的、不会出错的东西。压力越大，你越会回到那几样老味道——因为它们在，你就还好。",
    traits: ["压力大时特别想吃薯条", "对熟悉的味道有依赖", "饿的时候最讨厌做选择"],
    reasons: "经典咸香加上熟悉感，是最快的情绪复位方式",
    scenes: ["加班之后", "被否定之后", "一个人不想说话的晚上"],
    vector: {
      happiness_need: 0.9,
      spending: 0.4,
      taste: 0.35,
      adventure: 0.3,
      social: 0.35,
      recovery: 0.8,
    },
    gradient: { from: "#FFC72C", to: "#FF8A00", accent: "#FFD966" },
    shareText:
      "我的麦门人格是 🍟 黄金薯条治愈者——一份薯条，能把今天按回原位。",
  },
  {
    code: "coffee_survivor",
    emoji: "☕",
    name: "咖啡续命玩家",
    tagline: "我不困，我只是需要一杯。",
    description:
      "你的能量是借来的，靠咖啡因分期偿还。你不追求吃得多好，只追求清醒这件事不掉链子。",
    traits: ["一天至少一杯咖啡", "对提神效率很敏感", "常把吃饭当成任务"],
    reasons: "单位价格换来的清醒时间最长",
    scenes: ["早会之前", "通宵赶工", "下午三点"],
    vector: {
      happiness_need: 0.6,
      spending: 0.5,
      taste: 0.6,
      adventure: 0.45,
      social: 0.3,
      recovery: 0.15,
    },
    gradient: { from: "#8B5E3C", to: "#D9A066", accent: "#E8C39E" },
    shareText: "我的麦门人格是 ☕ 咖啡续命玩家——我不困，我只是需要一杯。",
  },
  {
    code: "big_mac_master",
    emoji: "🍔",
    name: "巨无霸掌控者",
    tagline: "世界很乱，至少分量是确定的。",
    description:
      "你要的是踏实。别人的满足感来自新鲜感，你的满足感来自「就是它，没错」。大分量对你来说不是贪心，是安全感。",
    traits: ["认准了就很少换", "讨厌吃不饱", "对确定性有执念"],
    reasons: "分量与满足感是第一指标",
    scenes: ["发薪日", "干成一件大事之后", "需要被安慰的周五"],
    vector: {
      happiness_need: 0.8,
      spending: 0.6,
      taste: 0.4,
      adventure: 0.25,
      social: 0.4,
      recovery: 0.75,
    },
    gradient: { from: "#DA291C", to: "#7A0E08", accent: "#FF6B5A" },
    shareText: "我的麦门人格是 🍔 巨无霸掌控者——世界很乱，至少分量是确定的。",
  },
  {
    code: "spicy_explorer",
    emoji: "🌶",
    name: "麦辣冒险家",
    tagline: "辣一下，才知道自己还活着。",
    description:
      "你的味觉需要刺激，菜单需要更新。一成不变对你来说不是稳定，是无聊。新品上市那天，你比谁都早。",
    traits: ["看到「新」字走不动路", "无辣不欢", "讨厌重复的选择"],
    reasons: "新鲜度与刺激感权重最高",
    scenes: ["新品上市当天", "周末", "需要一点刺激的下午"],
    vector: {
      happiness_need: 0.6,
      spending: 0.6,
      taste: 0.85,
      adventure: 0.9,
      social: 0.55,
      recovery: 0.4,
    },
    gradient: { from: "#FF4D2E", to: "#B3001B", accent: "#FF8A70" },
    shareText: "我的麦门人格是 🌶 麦辣冒险家——辣一下，才知道自己还活着。",
  },
  {
    code: "dessert_healer",
    emoji: "🍦",
    name: "甜品疗愈师",
    tagline: "甜的那一口，是给情绪的。",
    description:
      "你比谁都清楚吃的意义不只是饱。开心要吃，难过更要吃，而且必须有一口是甜的，这一天才算收尾。",
    traits: ["情绪和甜度强相关", "吃完饭必须有甜品", "很在意仪式感"],
    reasons: "甜味直接作用于情绪，是最高效的自我照顾",
    scenes: ["心情低落", "值得庆祝", "需要被哄一下的傍晚"],
    vector: {
      happiness_need: 0.85,
      spending: 0.55,
      taste: 0.9,
      adventure: 0.5,
      social: 0.5,
      recovery: 0.9,
    },
    gradient: { from: "#FF9EC4", to: "#FF6FA5", accent: "#FFC2D8" },
    shareText: "我的麦门人格是 🍦 甜品疗愈师——甜的那一口，是给情绪的。",
  },
  {
    code: "budget_master",
    emoji: "💰",
    name: "精打细算麦友",
    tagline: "不是花不起，是不想亏。",
    description:
      "你享受的不是省钱本身，是「我算得比你清楚」这件事。券后价、凑单临界点、第二份半价——这些都是你的游戏。",
    traits: ["点单前必看券包", "会为凑单精确到元", "对原价购买有生理不适"],
    reasons: "券后单价是唯一的评价标准",
    scenes: ["月末", "日常午餐", "任何有大额券的日子"],
    vector: {
      happiness_need: 0.4,
      spending: 0.1,
      taste: 0.4,
      adventure: 0.3,
      social: 0.35,
      recovery: 0.5,
    },
    gradient: { from: "#2E9E6B", to: "#0E6B45", accent: "#5FD9A0" },
    shareText: "我的麦门人格是 💰 精打细算麦友——不是花不起，是不想亏。",
  },
  {
    code: "share_player",
    emoji: "👥",
    name: "分享快乐玩家",
    tagline: "一个人吃是吃饭，一起吃才是过节。",
    description:
      "你的快乐需要见证者。点单时你想的是「这个大家会喜欢吗」，而不是「我想吃什么」。",
    traits: ["天然的组织者", "点单先问别人", "人越多吃得越香"],
    reasons: "分量与分享属性优先，人均价还更划算",
    scenes: ["聚会", "团建", "约朋友"],
    vector: {
      happiness_need: 0.7,
      spending: 0.6,
      taste: 0.55,
      adventure: 0.6,
      social: 0.95,
      recovery: 0.5,
    },
    gradient: { from: "#7C5CFF", to: "#4527C4", accent: "#A894FF" },
    shareText:
      "我的麦门人格是 👥 分享快乐玩家——一个人吃是吃饭，一起吃才是过节。",
  },
  {
    code: "night_coder",
    emoji: "🧑‍💻",
    name: "深夜代码战士",
    tagline: "你不是饿，你只是需要回血。",
    description:
      "你的饭点跟着编译结果走。白天随便对付，凌晨一点却格外清醒。你需要的不只是热量，是那种「再来一轮也没问题」的状态。",
    traits: ["深夜进食是常态", "一忙就忘记吃", "靠咖啡因和碳水续命"],
    reasons: "恢复效率比口味更重要",
    scenes: ["上线夜", "debug 到凌晨", "赶 deadline"],
    vector: {
      happiness_need: 0.85,
      spending: 0.45,
      taste: 0.55,
      adventure: 0.5,
      social: 0.2,
      recovery: 0.25,
    },
    gradient: { from: "#2BB3FF", to: "#0B4F8A", accent: "#7AD1FF" },
    shareText: "我的麦门人格是 🧑‍💻 深夜代码战士——你不是饿，你只是需要回血。",
  },
];

/** 按 code 查找人格 */
export function getPersona(code: string | undefined): Persona | undefined {
  if (!code) return undefined;
  return PERSONAS.find((p) => p.code === code);
}

/** 兜底人格（数据缺失时使用，保证页面永不崩溃） */
export const DEFAULT_PERSONA: Persona = PERSONAS[7];

/**
 * 人格 code → 名称映射，便于在 UI 中展示混合型的第二人格。
 */
export function getPersonaName(code: string | undefined): string {
  return getPersona(code)?.name ?? "";
}
