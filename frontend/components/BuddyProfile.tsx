"use client";

import { motion } from "framer-motion";

import { themeOf } from "@/lib/theme";
import type { BuddyProfile as BuddyProfileData, Persona } from "@/lib/types";

/**
 * 麦友档案。
 *
 * 展示数据来自 data/mockProfile（Phase 5 接入真实 Memory 后替换）。
 * 本组件只负责呈现，不做任何推导。
 */

type Props = {
  profile: BuddyProfileData;
  persona: Persona;
  animated?: boolean;
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function BuddyProfile({ profile, persona, animated = true }: Props) {
  const theme = themeOf(persona);
  const filled = Math.max(0, Math.min(5, profile.taste.level));

  return (
    <motion.div
      variants={container}
      initial={animated ? "hidden" : false}
      animate="show"
      className="space-y-4"
    >
      {/* 人格 */}
      <motion.section
        variants={fadeUp}
        className="glass relative overflow-hidden rounded-[28px] p-6"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ backgroundImage: theme.cardGradient }}
        />
        <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
          人格
        </p>
        <div className="mt-3 flex items-center gap-3.5">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{ backgroundImage: theme.cardGradient }}
            aria-hidden
          >
            {persona.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold">{persona.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {persona.tagline}
            </p>
          </div>
        </div>
      </motion.section>

      {/* 偏好三栏 */}
      <motion.section variants={fadeUp} className="grid grid-cols-3 gap-3">
        <InfoTile label="口味">
          <span className="text-sm leading-none">
            <span className="text-brand-yellow">{"★".repeat(filled)}</span>
            <span className="text-muted/40">{"☆".repeat(5 - filled)}</span>
          </span>
          <span className="mt-1.5 block text-xs text-muted">
            {profile.taste.label}
          </span>
        </InfoTile>

        <InfoTile label="预算">
          <span className="text-sm font-semibold">{profile.budget}</span>
          <span className="mt-1.5 block text-xs text-muted">每餐</span>
        </InfoTile>

        <InfoTile label="场景">
          <span className="text-sm font-semibold">{profile.scene}</span>
          <span className="mt-1.5 block text-xs text-muted">最常出现</span>
        </InfoTile>
      </motion.section>

      {/* AI 记得你的 3 件事 */}
      <motion.section
        variants={fadeUp}
        className="glass rounded-[28px] p-6"
      >
        <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
          AI 记得你的 {profile.memories.length} 件事
        </p>

        <ul className="mt-4 space-y-3.5">
          {profile.memories.map((memory) => (
            <li key={memory.id} className="flex items-start gap-3">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface2 text-base"
                aria-hidden
              >
                {memory.icon}
              </span>
              <span className="pt-1.5 text-sm leading-relaxed">
                {memory.text}
              </span>
            </li>
          ))}
        </ul>
      </motion.section>
    </motion.div>
  );
}

/** 三栏信息里的小卡片 */
function InfoTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl px-3 py-4 text-center">
      <p className="text-[10px] tracking-wider text-muted/70">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
