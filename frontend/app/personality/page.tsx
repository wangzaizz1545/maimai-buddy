"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { QuestionCard } from "@/components/QuestionCard";
import { ScreenShell } from "@/components/ScreenShell";
import { StepDots } from "@/components/StepDots";
import { QUESTIONS } from "@/data/questions";
import { readAnswers, saveAnswers } from "@/lib/store";
import type { Answers } from "@/lib/types";

/**
 * 麦门人格测试。
 *
 * 状态来源：lib/store 的 localStorage（刷新可恢复）。
 * 本页只负责「选择 → 保存 → 前进」，不做任何评分。
 *
 * 关于首屏：
 *   初始状态固定为「第 1 题 + 空作答」，与服务端预渲染结果一致，
 *   因此不会 hydration mismatch，且静态 HTML 里就有真实题目内容。
 *   已答过的用户会在 effect 中被还原到第一道未作答的题目——
 *   对首次到访的用户（绝大多数）而言完全无感知。
 */

/** 选中后停留时间，让用户看到点选反馈再切题 */
const ADVANCE_DELAY = 280;

export default function PersonalityPage() {
  const router = useRouter();

  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [pending, setPending] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 恢复进度：localStorage 只能在 effect 中读取
  useEffect(() => {
    const saved = readAnswers();
    if (!saved) return;

    setAnswers(saved);

    // 回到第一道未作答的题；全部答完则停在最后一题
    const firstUnanswered = QUESTIONS.findIndex((q) => !saved[q.id]);
    if (firstUnanswered > 0) {
      setIndex(firstUnanswered);
    }
  }, []);

  // 卸载时清掉待执行的跳转计时器，避免离开页面后仍触发路由跳转
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const question = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;

  // 切题后把焦点移到新题标题，避免键盘用户丢失焦点从头 Tab
  useEffect(() => {
    // 等 AnimatePresence 的入场动画挂载新 DOM 后再聚焦
    const id = setTimeout(() => {
      document
        .getElementById(`question-title-${question.id}`)
        ?.focus();
    }, 320);
    return () => clearTimeout(id);
  }, [index, question.id]);

  function handleSelect(optionId: string) {
    if (pending) return;

    const next: Answers = { ...answers, [question.id]: optionId };
    setAnswers(next);
    saveAnswers(next); // 立即保存
    setPending(optionId);

    timerRef.current = setTimeout(() => {
      setPending(null);

      if (isLast) {
        router.push("/analysis/");
      } else {
        setDirection(1);
        setIndex(index + 1);
      }
    }, ADVANCE_DELAY);
  }

  function handleBack() {
    if (pending || index === 0) return;
    setDirection(-1);
    setIndex(index - 1);
  }

  return (
    <>
      <GradientBackground />

      <ScreenShell center maxWidth="lg">
        {/* 产品语境 + 进度（题号计数由 StepDots 承载） */}
        <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-brand-yellow/80">
          麦门人格测试
        </p>
        <StepDots
          total={QUESTIONS.length}
          current={index}
          showCounter
          className="mb-6"
        />

        {/* 题目（切换动画由页面负责，卡片只做展示） */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={question.id}
            custom={direction}
            initial={{ opacity: 0, x: direction > 0 ? 36 : -36, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction > 0 ? -36 : 36, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <QuestionCard
              question={question}
              selectedOptionId={pending ?? answers[question.id]}
              disabled={pending !== null}
              onSelect={handleSelect}
            />
          </motion.div>
        </AnimatePresence>

        {/* 上一题 */}
        <div className="mt-8 h-5">
          {index > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={pending !== null}
              className="text-xs text-muted transition-colors hover:text-foreground disabled:opacity-40"
            >
              ← 上一题
            </button>
          ) : null}
        </div>
      </ScreenShell>
    </>
  );
}
