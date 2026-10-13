"use client";

import { motion } from "framer-motion";

import type { Question } from "@/lib/types";

/**
 * 单题卡片。
 *
 * 职责边界（刻意保持狭窄）：
 *   只负责展示题目、展示选项、处理点击。
 *   不包含任何评分逻辑，也不调用 scoring；不知道自己排在第几题——
 *   题目切换的 AnimatePresence 由页面负责，因为「当前是第几题」
 *   属于页面状态，不属于卡片。
 *
 * 视觉：整题坐在一张大玻璃卡片里（而不是裸暴露在页面上），
 * 避免出现「问卷表单」的观感。
 */

type Props = {
  question: Question;
  /** 当前已选中的选项（用于回显与刷新恢复） */
  selectedOptionId?: string;
  /** 切换动画期间禁用点击，防止连点 */
  disabled?: boolean;
  onSelect: (optionId: string) => void;
};

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function QuestionCard({
  question,
  selectedOptionId,
  disabled = false,
  onSelect,
}: Props) {
  // 选项较多时移动端用两列，其余保持单列大按钮
  const gridClass =
    question.columns === 3
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className="glass-3d highlight-top relative overflow-hidden rounded-card p-5 sm:p-8">

      <h2
        id={`question-title-${question.id}`}
        tabIndex={-1}
        className="text-balance text-[1.65rem] font-bold leading-snug outline-none sm:text-3xl"
      >
        {question.title}
      </h2>

      {question.subtitle ? (
        <p className="mt-2.5 text-sm text-muted">{question.subtitle}</p>
      ) : null}

      <motion.div
        variants={listVariants}
        initial="hidden"
        animate="show"
        role="group"
        aria-labelledby={`question-title-${question.id}`}
        className={`mt-6 grid gap-3 ${gridClass}`}
      >
        {question.options.map((option) => {
          const selected = option.id === selectedOptionId;

          return (
            <motion.button
              key={option.id}
              variants={itemVariants}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelect(option.id)}
              whileTap={{ scale: 0.96 }}
              className={[
                "flex items-center gap-3.5 rounded-2xl border px-4 py-4 text-left",
                "transition-all duration-200 disabled:pointer-events-none",
                selected
                  ? "border-brand-yellow/70 bg-brand-yellow/[0.12] shadow-lg shadow-brand-yellow/20"
                  : "border-white/10 bg-surface/60 hover:-translate-y-0.5 hover:border-white/20 hover:bg-surface2",
              ].join(" ")}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {option.emoji}
              </span>

              <span className="flex-1 text-sm font-medium sm:text-base">
                {option.label}
              </span>

              {/* 选中标记 */}
              <span
                aria-hidden
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] transition-all duration-200",
                  selected
                    ? "border-transparent bg-brand-yellow text-background"
                    : "border-white/15 text-transparent",
                ].join(" ")}
              >
                ✓
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
