"use client";

import { motion } from "framer-motion";

import { themeOf } from "@/lib/theme";
import type { Persona, PersonaResult } from "@/lib/types";

/**
 * 人格展示卡（结果页的核心视觉，后续分享海报也复用）。
 *
 * 配色方案说明：
 *   8 种人格的渐变里既有高亮黄（#FFC72C）也有深蓝（#0B4F8A），
 *   若把白字直接压在整块渐变上，亮色人格会出现对比度不足。
 *   因此采用「顶部渐变带 + 下方深色正文区」的结构：
 *   颜色identity 保留在色带上，文字始终落在深色底上，8 种人格都可读。
 */

type Props = {
  persona: Persona;
  /** 匹配结果：用于展示匹配度与混合型 */
  result?: PersonaResult | null;
  /** 混合型的第二人格 */
  secondaryPersona?: Persona;
  /** 是否播放入场动画（跳过动画时为 false） */
  animated?: boolean;
  className?: string;
};

export function PersonalityCard({
  persona,
  result,
  secondaryPersona,
  animated = true,
  className = "",
}: Props) {
  const theme = themeOf(persona);
  const isMixed = Boolean(secondaryPersona);

  return (
    <motion.article
      initial={
        animated ? { opacity: 0, rotateX: -70, y: 24 } : false
      }
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformPerspective: 1000 }}
      className={[
        "overflow-hidden rounded-[32px] border border-white/10 bg-surface",
        "shadow-[0_24px_48px_-16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      ].join(" ")}
    >
      {/* 顶部渐变带 */}
      <div
        className="relative flex h-32 items-center justify-center"
        style={{ backgroundImage: theme.cardGradient }}
      >
        <span className="text-6xl drop-shadow-lg" aria-hidden>
          {persona.emoji}
        </span>
        {/* 与下方深色区衔接的渐隐 */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-surface"
        />
      </div>

      {/* 正文 */}
      <div className="px-6 pb-7 pt-1 text-center sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {persona.name}
        </h1>

        <p className="mt-3 text-balance text-sm leading-relaxed text-muted sm:text-base">
          {persona.tagline}
        </p>

        {result ? (
          <p className="mt-4 text-xs text-muted/70">
            {isMixed && secondaryPersona ? (
              <>
                混合型 ·{" "}
                <span className="text-brand-yellow">
                  {persona.name} × {secondaryPersona.name}
                </span>
              </>
            ) : (
              <>
                匹配度{" "}
                <span className="text-brand-yellow">{result.confidence}%</span>
              </>
            )}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
