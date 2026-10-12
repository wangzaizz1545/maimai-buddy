"use client";

import { motion } from "framer-motion";

import { DIMENSIONS } from "@/data/questions";
import { themeOf } from "@/lib/theme";
import type { BuddyProfile, Persona, PersonaResult } from "@/lib/types";

/**
 * 分享海报（3:4 竖版，朋友圈 / GitHub README 展示用）。
 *
 * 配色策略（与 PersonalityCard 刻意不同）：
 *   结果页的卡片用「渐变带 + 深色正文」保证列表可读；
 *   海报是发布物，需要更强的色彩冲击，因此采用**全幅渐变 + 自下而上的暗色蒙版**——
 *   上半部分保留人格原色（只放 emoji），下半部分压暗后承载文字。
 *
 * 布局稳健性：
 *   字号与行高刻意保守，emoji 区用 flex-1 + min-h-0，
 *   即使文案变长也只会压缩 emoji 区，不会撑破 3:4 画框。
 *
 * 组件内不放置任何交互元素，保证截图干净。
 */

type Props = {
  persona: Persona;
  /** 匹配结果：用于展示最突出的一维 */
  result?: PersonaResult | null;
  profile?: BuddyProfile | null;
  /** 今日状态（来自作答上下文） */
  mood?: string | null;
  animated?: boolean;
  className?: string;
};

/** 自上而下的暗色蒙版：顶部近乎透明，底部接近不透明 */
const SCRIM =
  "linear-gradient(180deg, rgba(10,10,12,0.10) 0%, rgba(10,10,12,0.55) 42%, rgba(10,10,12,0.92) 78%, rgba(10,10,12,0.97) 100%)";

export function SharePoster({
  persona,
  result,
  profile,
  mood,
  animated = true,
  className = "",
}: Props) {
  const theme = themeOf(persona);

  // 最突出的一维：给海报一个「这是关于我」的数据锚点
  const topDimension = result
    ? DIMENSIONS.map((d) => ({
        label: d.label,
        value: result.vector[d.key] ?? 0,
      })).sort((a, b) => b.value - a.value)[0]
    : null;

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.96 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-[28px] border border-white/10",
        className,
      ].join(" ")}
    >
      {/* 1. 人格渐变底 */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: theme.cardGradient }}
      />

      {/* 2. 暗色蒙版 */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{ backgroundImage: SCRIM }}
      />

      {/* 3. 顶部排版锚点：人格代号 */}
      <p className="relative px-7 pt-6 text-[9px] font-semibold tracking-[0.3em] text-white/45">
        {persona.code.replace(/_/g, " ").toUpperCase()}
      </p>

      {/* 4. emoji 区（带柔光，可被压缩但不会撑破画框） */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <span
          aria-hidden
          className="absolute h-40 w-40 rounded-full blur-3xl"
          style={{ background: theme.glow, opacity: 0.45 }}
        />
        <span
          className="relative text-[4.75rem] leading-none drop-shadow-2xl"
          aria-hidden
        >
          {persona.emoji}
        </span>
      </div>

      {/* 5. 文字区 */}
      <div className="relative px-7 pb-7">
        <p className="text-[10px] font-semibold tracking-[0.26em] text-white/50">
          我的麦门人格
        </p>

        <h2 className="mt-1.5 text-[1.9rem] font-bold leading-tight text-white">
          {persona.name}
        </h2>

        {/* 渐变细线分隔 */}
        <span
          aria-hidden
          className="mt-3.5 block h-px w-10"
          style={{ backgroundImage: theme.cardGradient }}
        />

        <p className="mt-3 text-[10px] font-semibold tracking-[0.2em] text-white/40">
          AI 评价
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-white/85">
          「{persona.tagline}」
        </p>

        {/* 数据锚点 + 上下文 */}
        <div className="mt-4 space-y-1 text-[10px] leading-normal text-white/55">
          {topDimension ? (
            <p>
              最突出 · {topDimension.label}{" "}
              <span className="text-white/80">
                {Math.round(topDimension.value * 100)}%
              </span>
            </p>
          ) : null}
          {mood ? <p>今日状态 · {mood}</p> : null}
          {profile ? (
            <p>
              预算 {profile.budget} · 场景 {profile.scene}
            </p>
          ) : null}
        </div>

        {/* 落款 */}
        <div className="mt-4 flex items-end justify-between border-t border-white/12 pt-3.5">
          <div>
            <p className="text-[13px] font-semibold text-white">McBuddy AI</p>
            <p className="mt-0.5 text-[9px] text-white/45">
              麦麦搭子 · 会记住你的 AI 搭子
            </p>
          </div>
          <span className="text-lg" aria-hidden>
            🍔
          </span>
        </div>
      </div>
    </motion.div>
  );
}
