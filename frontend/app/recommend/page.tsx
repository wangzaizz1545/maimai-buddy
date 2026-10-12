"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ScreenShell } from "@/components/ScreenShell";
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import { loadRecommendContext } from "@/lib/provider";
import type { DataSource, SelectedStore } from "@/lib/provider";
import { budgetCeilingOf, recommend, type Recommendation } from "@/lib/recommend";
import { deriveContext } from "@/lib/scoring";
import { readAnswers, readPersona } from "@/lib/store";
import { readSelectedStore } from "@/lib/storeSelection";
import { themeOf } from "@/lib/theme";
import type { AnswerContext, Persona } from "@/lib/types";

/**
 * 麦友今日推荐。
 *
 * 数据来源：`lib/provider` 的 `loadRecommendContext()`
 *   - HTTP 优先 → backend → MCP Adapter → 麦当劳 MCP
 *   - 后端不可用 → 自动降级到本地演示数据
 *
 * 页面**不直接调用 MCP**，也不感知数据来自哪里；
 * 它只做两件事：把 `source` 如实展示给用户，把数据交给推荐引擎。
 */

type PageState = {
  persona: Persona;
  recommendation: Recommendation;
  context: AnswerContext | null;
  /** 数据来源，用于诚实标注 */
  source: DataSource;
  /** 是否发生了降级（后端不可用） */
  degraded: boolean;
  /** 用户在 /store 页选中的门店；未选择时为 null（后端用收藏门店） */
  store: SelectedStore | null;
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

export default function RecommendPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = readPersona();
      if (!result) {
        router.replace("/personality/");
        return;
      }

      const persona = getPersona(result.code) ?? DEFAULT_PERSONA;
      const answers = readAnswers();
      const context = answers ? deriveContext(answers) : null;

      // 用户在 /store 页选中的门店会一路传到 MCP：
      // 菜单、优惠券、价格都按该门店返回
      const store = readSelectedStore();

      // HTTP 优先，失败自动降级（内部已处理，不会抛异常）
      const loaded = await loadRecommendContext(store?.storeCode);
      if (cancelled) return;

      setState({
        persona,
        recommendation: recommend(
          persona,
          result.vector,
          budgetCeilingOf(answers),
          { meals: loaded.context.meals, coupons: loaded.context.coupons }
        ),
        context,
        source: loaded.context.source,
        degraded: loaded.degraded,
        store,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!state) {
    return (
      <>
        <GradientBackground />
        <ScreenShell center maxWidth="lg">
          <p className="text-sm text-muted">正在为你搭配…</p>
        </ScreenShell>
      </>
    );
  }

  const { persona, recommendation, context, source, degraded, store } = state;
  const theme = themeOf(persona);
  const { pricing, budgetTip } = recommendation;

  return (
    <>
      <GradientBackground from={theme.from} to={theme.to} />

      <ScreenShell maxWidth="lg">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.p
            variants={fadeUp}
            className="mb-2 text-center text-xs font-semibold tracking-[0.2em] text-brand-yellow/80"
          >
            麦友今日推荐
          </motion.p>

          {context ? (
            <motion.p
              variants={fadeUp}
              className="mb-4 text-center text-xs text-muted/70"
            >
              {persona.emoji} {persona.name} · 预算 {context.budget} · 场景{" "}
              {context.scene}
            </motion.p>
          ) : null}

          {/* 数据来源徽标：如实标注，绝不把演示数据谎报成实时数据 */}
          <motion.div variants={fadeUp} className="mb-3 flex justify-center">
            <DataSourceBadge source={source} degraded={degraded} />
          </motion.div>

          {/* 当前门店：菜单与价格都按它返回 */}
          <motion.div
            variants={fadeUp}
            className="mb-4 flex flex-col items-center gap-1.5"
          >
            {store ? (
              <p className="text-center text-[11px] leading-relaxed text-muted/70">
                <span className="text-muted/50">门店 · </span>
                {store.storeName}
              </p>
            ) : (
              <p className="text-center text-[11px] text-muted/50">
                使用收藏门店
              </p>
            )}
            <button
              type="button"
              onClick={() => router.push("/store/")}
              className="text-[11px] text-brand-yellow/80 transition-colors hover:text-brand-yellow"
            >
              {store ? "更换门店" : "选择门店"}
            </button>
          </motion.div>

          {/* 推荐卡 */}
          <motion.div variants={fadeUp}>
            <RecommendationCard
              persona={persona}
              recommendation={recommendation}
            />
          </motion.div>

          {/* 预算建议 */}
          <motion.section variants={fadeUp} className="glass mt-4 rounded-[28px] p-6">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
              预算建议
            </p>
            <p className="mt-2.5 text-sm leading-relaxed">{budgetTip}</p>
            {recommendation.upgradeHint ? (
              <p className="mt-3 rounded-2xl border border-brand-yellow/25 bg-brand-yellow/[0.07] px-3.5 py-2.5 text-xs leading-relaxed text-brand-yellow/90">
                {recommendation.upgradeHint}
              </p>
            ) : null}
            <p className="mt-3 text-[11px] text-muted/60">
              预算上限 ¥{pricing.ceiling} · 当前合计 ¥{pricing.original.toFixed(1)}
            </p>
          </motion.section>

          {/* 优惠模拟 */}
          <motion.section variants={fadeUp} className="glass mt-4 rounded-[28px] p-6">
            <p className="text-[10px] font-semibold tracking-[0.22em] text-muted">
              优惠模拟
            </p>

            <dl className="mt-3.5 space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">可用券</dt>
                <dd>
                  {pricing.coupon ? (
                    <span className="text-brand-yellow">{pricing.coupon.name}</span>
                  ) : (
                    <span className="text-muted/60">暂无</span>
                  )}
                </dd>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-muted">已省</dt>
                <dd className="tabular-nums">
                  {pricing.saved > 0 ? `¥${pricing.saved.toFixed(1)}` : "—"}
                </dd>
              </div>

              {pricing.nextCoupon ? (
                <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                  <dt className="text-muted">距「{pricing.nextCoupon.name}」</dt>
                  <dd className="tabular-nums text-muted">
                    还差 ¥{pricing.gapToNext.toFixed(1)}
                  </dd>
                </div>
              ) : (
                <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                  <dt className="text-muted">
                    {pricing.coupon ? "已用上最大档优惠" : "当前无可用优惠"}
                  </dt>
                  <dd className="text-brand-yellow">{pricing.coupon ? "✓" : "—"}</dd>
                </div>
              )}
            </dl>
          </motion.section>

          {/* 行动点 */}
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <PrimaryButton href="/share/" size="md">
              生成分享卡片
            </PrimaryButton>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => router.push("/result/")}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                返回结果
              </button>
              <button
                type="button"
                onClick={() => router.push("/buddy/")}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                麦友档案
              </button>
            </div>
          </motion.div>

          {/* 数据来源说明 */}
          <motion.p
            variants={fadeUp}
            className="mt-8 text-center text-[11px] leading-relaxed text-muted/50"
          >
            {source === "mcp"
              ? "数据来自麦当劳 MCP 实时接口"
              : "演示数据 · 菜单与优惠为本地样例，不代表真实价格"}
          </motion.p>
        </motion.div>
      </ScreenShell>
    </>
  );
}

/** 数据来源徽标 */
function DataSourceBadge({
  source,
  degraded,
}: {
  source: DataSource;
  degraded: boolean;
}) {
  const isLive = source === "mcp";

  const dot = isLive ? "bg-emerald-400" : "bg-amber-400";
  const label = isLive
    ? "实时数据"
    : degraded
      ? "演示数据 · 后端未连接"
      : "演示数据";

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px]",
          isLive
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-amber-400/25 bg-amber-400/10 text-amber-200/90",
        ].join(" ")}
      >
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>

      {degraded && !isLive ? (
        <span className="text-[10px] text-muted/50">
          后端不可用或门店未营业，已自动降级
        </span>
      ) : null}
    </div>
  );
}
