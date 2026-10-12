"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { PERSONAS } from "@/data/personas";
import { fetchRuntimeInfo, type RuntimeInfo } from "@/lib/api";
import { themeOf } from "@/lib/theme";

/**
 * 首页。
 *
 * 目标：3 秒内让人理解「这是一个会认识我的 AI 麦当劳搭子」。
 * 结构：ScreenShell（容器）→ GradientBackground（背景）→ Hero 内容 → CTA
 *
 * 页面只负责组装，容器/背景/按钮分别由三个组件承担。
 */

/** 入场动画：逐项上浮淡入，子项间隔 0.12s */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function Home() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);

  // 仅用于页脚的模式指示：连通后端时点亮小圆点。
  // 失败静默处理，首页在纯静态环境下也必须完整可用。
  useEffect(() => {
    fetchRuntimeInfo()
      .then(setRuntime)
      .catch(() => setRuntime(null));
  }, []);

  return (
    <>
      <GradientBackground />

      <ScreenShell center maxWidth="xl">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center"
        >
          {/* 品牌图标 */}
          <motion.div variants={fadeUp} className="relative">
            <span
              aria-hidden
              className="absolute inset-0 -z-10 rounded-full bg-brand-red/40 blur-3xl"
            />
            <span className="block text-6xl sm:text-7xl">🍔</span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            variants={fadeUp}
            className="mt-6 text-[2.75rem] font-bold leading-none tracking-tight sm:text-6xl"
          >
            McBuddy AI
          </motion.h1>

          {/* 副标题 */}
          <motion.p
            variants={fadeUp}
            className="mt-4 text-lg text-muted sm:text-xl"
          >
            你的 AI 麦当劳搭子。
          </motion.p>

          {/* 辅助文案：产品的核心承诺 */}
          <motion.div
            variants={fadeUp}
            className="glass mt-8 w-full max-w-sm rounded-card px-6 py-5"
          >
            <p className="text-base leading-relaxed">
              第一次见面，<span className="text-brand-yellow">它认识你</span>。
            </p>
            <p className="mt-1.5 text-base leading-relaxed">
              以后，<span className="text-brand-yellow">它记得你</span>。
            </p>
          </motion.div>

          {/* 主行动点 */}
          <motion.div variants={fadeUp} className="mt-8">
            <PrimaryButton href="/personality/" size="lg">
              开始麦门人格测试
            </PrimaryButton>
          </motion.div>

          {/* 人格预览：用 8 种人格的主题色，暗示测试有 8 种结果 */}
          <motion.div variants={fadeUp} className="mt-14">
            <p className="text-xs tracking-wide text-muted/70">
              8 种麦门人格，你是哪一种
            </p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2.5">
              {PERSONAS.map((persona) => {
                const theme = themeOf(persona);
                return (
                  <li
                    key={persona.code}
                    title={persona.name}
                    className="flex h-10 w-10 items-center justify-center rounded-full border bg-surface text-lg"
                    style={{
                      borderColor: theme.ring,
                      boxShadow: `0 0 18px ${theme.glow}22`,
                    }}
                  >
                    <span aria-hidden>{persona.emoji}</span>
                    <span className="sr-only">{persona.name}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>

          {/* 页脚：合规声明 + 模式指示 */}
          <motion.footer
            variants={fadeUp}
            className="mt-16 space-y-1.5 text-xs text-muted/60"
          >
            <p>非麦当劳官方产品 · 参赛作品</p>
            <p className="flex items-center justify-center gap-1.5">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  runtime ? "bg-emerald-400" : "bg-muted/40"
                }`}
              />
              演示模式 · 零 Token · 零 API Key
            </p>
          </motion.footer>
        </motion.div>
      </ScreenShell>
    </>
  );
}
