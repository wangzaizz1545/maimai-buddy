"use client";

import { motion } from "framer-motion";

import { themeOf } from "@/lib/theme";
import type { Recommendation } from "@/lib/recommend";
import type { Persona } from "@/lib/types";

/**
 * 今日推荐卡。
 *
 * 纯展示组件：不做任何推荐计算，只渲染 lib/recommend 的结果。
 * 所有价格均为演示数据。
 */

type Props = {
  persona: Persona;
  recommendation: Recommendation;
  animated?: boolean;
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function RecommendationCard({ persona, recommendation, animated = true }: Props) {
  const theme = themeOf(persona);
  const { items, pricing, drivers, reason, matchScore, happiness, alternatives } =
    recommendation;

  return (
    <motion.article
      variants={container}
      initial={animated ? "hidden" : false}
      animate="show"
      className="glass relative overflow-hidden rounded-[28px] p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ backgroundImage: theme.cardGradient }}
      />

      {/* 套餐构成 */}
      <motion.div variants={fadeUp}>
        <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
          今日推荐
        </p>
        <h2 className="mt-2.5 text-xl font-bold leading-snug">
          {items.map((item) => item.name).join(" + ")}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {items.map((item) => (
            <li key={item.code}>
              {item.name} <span className="text-muted/70">¥{item.price}</span>
              <span className="ml-1 text-muted/60">{item.kcal} kcal</span>
            </li>
          ))}
        </ul>
      </motion.div>

      {/* 价格明细 */}
      <motion.dl variants={fadeUp} className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">原价</dt>
          <dd className="tabular-nums">¥{pricing.original.toFixed(1)}</dd>
        </div>

        <div className="flex items-center justify-between">
          <dt className="text-muted">
            优惠
            {pricing.coupon ? (
              <span className="ml-2 text-xs text-muted/70">{pricing.coupon.name}</span>
            ) : (
              <span className="ml-2 text-xs text-muted/60">暂无可用券</span>
            )}
          </dt>
          <dd className="tabular-nums text-brand-yellow">
            {pricing.saved > 0 ? `-¥${pricing.saved.toFixed(1)}` : "—"}
          </dd>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <dt className="font-semibold">券后实付</dt>
          <dd className="text-lg font-bold tabular-nums text-brand-yellow">
            ¥{pricing.payable.toFixed(1)}
          </dd>
        </div>
      </motion.dl>

      {/* 两个指标 */}
      <motion.div variants={fadeUp} className="mt-5 space-y-3">
        <Metric label="匹配度" value={matchScore} accent={theme.accent} />
        <Metric label="快乐值" value={happiness} accent={theme.accent} />
      </motion.div>

      {/* 推荐理由 */}
      <motion.div variants={fadeUp} className="mt-5 border-t border-white/10 pt-4">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
          推荐理由
        </p>
        <p className="mt-2 text-sm leading-relaxed">{reason}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {drivers.map((d) => (
            <li
              key={d.key}
              className="rounded-full border border-white/10 bg-surface/60 px-3 py-1 text-[11px] text-muted"
            >
              {d.label} · {Math.round(d.fit * 100)}%
            </li>
          ))}
        </ul>
      </motion.div>

      {/* 备选 */}
      {alternatives.length > 0 ? (
        <motion.div variants={fadeUp} className="mt-5 border-t border-white/10 pt-4">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
            备选
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {alternatives.map((meal) => (
              <li key={meal.code} className="flex items-center justify-between text-xs">
                <span className="text-muted">{meal.name}</span>
                <span className="tabular-nums text-muted/70">¥{meal.price}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ) : null}
    </motion.article>
  );
}

/** 0–100 的指标条 */
function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs text-muted">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: accent }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums">{pct}%</span>
    </div>
  );
}
