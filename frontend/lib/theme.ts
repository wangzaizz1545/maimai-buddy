import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import type { Persona } from "@/lib/types";

/**
 * 人格主题派生。
 *
 * 本项目不为 Persona 数据结构新增字段（data/personas.ts 属核心资产，保持冻结），
 * 而是把已有的 gradient 三元组（from / to / accent）在 UI 层派生成一整套主题，
 * 让 8 种人格自动获得 8 套视觉：页面背景、光晕、卡片渐变、描边。
 *
 * 单一映射来源，结果页、档案页、分享海报共用同一套派生规则。
 */
export type PersonaTheme = {
  /** 渐变起点色 */
  from: string;
  /** 渐变终点色 */
  to: string;
  /** 强调色 */
  accent: string;
  /** 光晕色（取强调色） */
  glow: string;
  /** 用作背景的径向渐变 */
  background: string;
  /** 卡片/海报主渐变 */
  cardGradient: string;
  /** 描边色（强调色低透明度） */
  ring: string;
};

/** 由人格推导主题 */
export function themeOf(persona: Persona): PersonaTheme {
  const { from, to, accent } = persona.gradient;

  return {
    from,
    to,
    accent,
    glow: accent,
    background: `radial-gradient(circle, ${from} 0%, transparent 70%)`,
    cardGradient: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
    ring: `${accent}33`,
  };
}

/** 由人格 code 推导主题；code 缺失或非法时回退默认人格 */
export function themeOfCode(code: string | undefined): PersonaTheme {
  return themeOf(getPersona(code) ?? DEFAULT_PERSONA);
}
