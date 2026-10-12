"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { PersonalityCard } from "@/components/PersonalityCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RadarChart } from "@/components/RadarChart";
import { ScreenShell } from "@/components/ScreenShell";
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import { DIMENSIONS } from "@/data/questions";
import { readPersona } from "@/lib/store";
import { themeOf } from "@/lib/theme";
import type { PersonaResult } from "@/lib/types";

/**
 * 人格结果页（截图主战场）。
 *
 * 设计约束：
 *   1. 不渲染任何导航栏，避免入镜影响截图
 *   2. 页面背景使用该人格的主题色，8 种人格观感各不相同
 *   3. 揭晓动效约 2 秒，1.5 秒后出现「跳过动画」，方便连续试测
 *
 * 数据来源：localStorage 的 persona（由 /analysis 写入），本页只读。
 */

const SKIP_AFTER_MS = 1500;

/** 逐段揭晓：子项间隔 0.18s */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function ResultPage() {
  const router = useRouter();

  const [result, setResult] = useState<PersonaResult | null>(null);
  const [checked, setChecked] = useState(false);
  const [instant, setInstant] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  // 读取结果；没有结果时退回测试页（localStorage 只能在 effect 中读）
  useEffect(() => {
    const saved = readPersona();
    if (!saved) {
      router.replace("/personality/");
      return;
    }
    setResult(saved);
    setChecked(true);
  }, [router]);

  // 动效播完后提供跳过入口
  useEffect(() => {
    if (!checked) return;
    const timer = setTimeout(() => setShowSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, [checked]);

  if (!checked || !result) {
    return (
      <>
        <GradientBackground />
        <ScreenShell center maxWidth="lg">
          <p className="text-sm text-muted">正在读取你的结果…</p>
        </ScreenShell>
      </>
    );
  }

  const persona = getPersona(result.code) ?? DEFAULT_PERSONA;
  const secondaryPersona = getPersona(result.secondaryCode);
  const theme = themeOf(persona);

  // 最突出的一维，用于给雷达图配一句解读
  const topDimension = DIMENSIONS.map((d) => ({
    label: d.label,
    value: result.vector[d.key] ?? 0,
  })).sort((a, b) => b.value - a.value)[0];

  return (
    <>
      {/* 背景跟随人格主题色 */}
      <GradientBackground from={theme.from} to={theme.to} />

      <ScreenShell maxWidth="lg">
        {/* 切换 key 以在「跳过动画」时以最终状态直接重挂载 */}
        <div key={instant ? "instant" : "animated"}>
          <motion.div
            variants={container}
            initial={instant ? false : "hidden"}
            animate="show"
          >
            {/* 语境标签 */}
            <motion.p
              variants={fadeUp}
              className="mb-5 text-center text-xs font-semibold tracking-[0.2em] text-brand-yellow/80"
            >
              你的麦门人格
            </motion.p>

            {/* 人格卡 */}
            <motion.div variants={fadeUp}>
              <PersonalityCard
                persona={persona}
                result={result}
                secondaryPersona={secondaryPersona}
                animated={!instant}
              />
            </motion.div>

            {/* 特点 */}
            <motion.section variants={fadeUp} className="mt-9">
              <h2 className="text-xs font-semibold tracking-wider text-muted">
                你的特点
              </h2>
              <ul className="mt-3 space-y-2.5">
                {persona.traits.map((trait) => (
                  <li key={trait} className="flex items-start gap-2.5 text-sm">
                    <span aria-hidden className="text-brand-yellow">
                      ✓
                    </span>
                    <span>{trait}</span>
                  </li>
                ))}
              </ul>
            </motion.section>

            {/* 六维画像 */}
            <motion.section variants={fadeUp} className="mt-11">
              <h2 className="text-xs font-semibold tracking-wider text-muted">
                你的六维画像
              </h2>
              <div className="mt-4 flex justify-center">
                <RadarChart
                  vector={result.vector}
                  accent={theme.accent}
                  animated={!instant}
                />
              </div>
              <p className="mt-4 text-center text-xs text-muted">
                最突出的一维：
                <span className="text-foreground">{topDimension.label}</span>
                <span className="text-muted/60">
                  {" "}
                  · {Math.round(topDimension.value * 100)}%
                </span>
              </p>
            </motion.section>

            {/* 推荐场景 */}
            <motion.section variants={fadeUp} className="mt-11">
              <h2 className="text-xs font-semibold tracking-wider text-muted">
                推荐场景
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {persona.scenes.map((scene) => (
                  <li
                    key={scene}
                    className="rounded-full border border-white/10 bg-surface/70 px-3.5 py-1.5 text-xs"
                  >
                    {scene}
                  </li>
                ))}
              </ul>
            </motion.section>

            {/* 行动点 */}
            <motion.div
              variants={fadeUp}
              className="mt-12 flex flex-col items-center gap-3"
            >
              {/* 先选门店再推荐：菜单、优惠与价格都按门店返回 */}
              <PrimaryButton href="/store/">看看今天吃什么</PrimaryButton>
              <PrimaryButton href="/share/" variant="ghost" size="md">
                分享我的麦门人格
              </PrimaryButton>
              <PrimaryButton href="/buddy/" variant="ghost" size="md">
                查看麦友档案
              </PrimaryButton>
            </motion.div>

            {/* 重新测试（方便连续试玩不同人格） */}
            <motion.p variants={fadeUp} className="mt-8 text-center">
              <button
                type="button"
                onClick={() => router.push("/personality/")}
                className="text-xs text-muted/60 transition-colors hover:text-foreground"
              >
                重新测一次
              </button>
            </motion.p>
          </motion.div>
        </div>
      </ScreenShell>

      {/* 跳过动画 */}
      {showSkip && !instant ? (
        <button
          type="button"
          onClick={() => setInstant(true)}
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-surface/80 px-4 py-1.5 text-xs text-muted backdrop-blur transition-colors hover:text-foreground"
        >
          跳过动画
        </button>
      ) : null}
    </>
  );
}
