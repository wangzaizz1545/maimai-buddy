"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * AI 分析动画（纯视觉）。
 *
 * 不参与任何计算：人格的计算与落库由页面负责，
 * 这里只负责在约 2.6 秒后通过 onComplete 通知页面可以跳转了。
 */

const STEPS = [
  "分析你的选择",
  "建立麦友画像",
  "匹配麦门人格",
  "生成你的结果",
];

/** 每步 0.6 秒 */
const STEP_MS = 600;
/** 最后一步完成后的停顿 */
const TAIL_MS = 200;

type Props = {
  onComplete: () => void;
};

export function AnalysisAnimation({ onComplete }: Props) {
  const [doneCount, setDoneCount] = useState(0);

  // 用 ref 持有回调，避免父组件重渲染导致计时器被重置
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setDoneCount(i + 1), (i + 1) * STEP_MS));
    });

    timers.push(
      setTimeout(
        () => onCompleteRef.current(),
        STEPS.length * STEP_MS + TAIL_MS
      )
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex w-full flex-col items-center text-center">
      {/* 光球 */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-brand-red/40 blur-2xl"
          animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.85, 0.45] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          className="relative text-5xl"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          🍔
        </motion.span>
      </div>

      <h1 className="mt-8 text-xl font-semibold sm:text-2xl">
        正在认识你的麦门灵魂…
      </h1>

      {/* 四个步骤 */}
      <ul
        className="mt-10 w-full max-w-xs space-y-3.5 text-left"
        role="status"
        aria-live="polite"
      >
        {STEPS.map((label, i) => {
          const done = doneCount > i;
          const active = doneCount === i;

          return (
            <li key={label} className="flex items-center gap-3">
              <motion.span
                animate={{ scale: done ? [0.8, 1.15, 1] : 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  done
                    ? "border-transparent bg-brand-yellow text-background"
                    : active
                      ? "animate-pulse border-brand-yellow/70 text-brand-yellow"
                      : "border-white/15 text-muted/60",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </motion.span>

              <span
                className={[
                  "text-sm transition-colors duration-300 sm:text-base",
                  done
                    ? "text-foreground"
                    : active
                      ? "text-foreground/80"
                      : "text-muted/60",
                ].join(" ")}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
