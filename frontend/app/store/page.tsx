"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { ScreenShell } from "@/components/ScreenShell";
import { loadStoreSearch } from "@/lib/provider";
import type { DataSource, ProviderStore } from "@/lib/provider";
import { readSelectedStore, saveSelectedStore } from "@/lib/storeSelection";

/**
 * 选择麦当劳门店。
 *
 * 为什么需要这一页：
 *   麦当劳 MCP 的 `query-meals` / `query-store-coupons` / `calculate-price`
 *   **都强制要求 storeCode**。不选门店就只能由后端回退到收藏门店，
 *   用户无法指定「我就要看这家店的菜单」。
 *
 * 数据来源：`/api/store/search` → backend → MCP `query-nearby-stores`。
 * 后端不可用时自动降级到本地演示门店，徽标会如实标注。
 */

type Status = "idle" | "loading" | "done";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function StorePage() {
  const router = useRouter();

  const [city, setCity] = useState("");
  const [keyword, setKeyword] = useState("");

  const [stores, setStores] = useState<ProviderStore[]>([]);
  const [source, setSource] = useState<DataSource>("mock");
  const [degraded, setDegraded] = useState(false);
  const [mode, setMode] = useState<"favorites" | "search">("favorites");
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState("");

  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // 请求序号：防止快速连点搜索时，前一次慢请求的返回覆盖后一次结果
  const searchSeq = useRef(0);

  const runSearch = useCallback(
    async (nextCity: string, nextKeyword: string) => {
      const seq = ++searchSeq.current;
      setStatus("loading");
      setNotice("");

      const { result, degraded: didDegrade } = await loadStoreSearch(
        nextCity,
        nextKeyword
      );

      // 已有更新的请求发出，丢弃本次过期结果
      if (seq !== searchSeq.current) return;

      setStores(result.stores);
      setSource(result.source);
      setDegraded(didDegrade);
      setMode(result.mode);
      setStatus("done");

      if (result.stores.length === 0) {
        setNotice("没有找到门店。试试换个城市或更宽泛的关键词。");
      }
    },
    []
  );

  // 首屏：先展示收藏门店，避免空白页
  useEffect(() => {
    const saved = readSelectedStore();
    if (saved) setSelectedCode(saved.storeCode);
    void runSearch("", "");
  }, [runSearch]);

  // 真实 MCP 的搜索接口要求城市与关键词**同时**提供
  const canSearch = city.trim().length > 0 && keyword.trim().length > 0;

  function choose(store: ProviderStore) {
    saveSelectedStore(store);
    setSelectedCode(store.storeCode);
    router.push("/recommend/");
  }

  return (
    <>
      <GradientBackground />

      <ScreenShell maxWidth="lg">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.p
            variants={fadeUp}
            className="mb-2 text-center text-xs font-semibold tracking-[0.2em] text-brand-yellow/80"
          >
            选择门店
          </motion.p>
          <motion.p
            variants={fadeUp}
            className="mb-5 text-center text-xs leading-relaxed text-muted/70"
          >
            菜单、优惠与价格都按门店返回
            <br />
            选一家离你近的
          </motion.p>

          {/* 搜索区 */}
          <motion.section variants={fadeUp} className="glass-3d rounded-card p-5">
            <form
              className="flex flex-col gap-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSearch) void runSearch(city, keyword);
              }}
            >
              <label className="sr-only" htmlFor="store-city">
                城市
              </label>
              <input
                id="store-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="城市（例如：上海）"
                className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-brand-yellow/50 focus:outline-none"
              />
              <label className="sr-only" htmlFor="store-keyword">
                关键词
              </label>
              <input
                id="store-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="关键词（商圈 / 地标 / 路名）"
                className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-brand-yellow/50 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!canSearch || status === "loading"}
                className={[
                  "mt-0.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                  "active:scale-[0.98]",
                  canSearch
                    ? "bg-gradient-to-r from-brand-yellow to-brand-orange text-black shadow-lg shadow-brand-yellow/20 hover:brightness-105 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.4)]"
                    : "cursor-not-allowed bg-white/[0.06] text-muted/50",
                ].join(" ")}
              >
                {status === "loading" ? "搜索中…" : "搜索门店"}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-muted/60">
                麦当劳 MCP 的搜索要求<b className="text-muted/80">城市与关键词同时填写</b>
                <br />
                不填则显示你的收藏门店
              </p>
            </form>
          </motion.section>

          {/* 数据来源徽标 */}
          <motion.div variants={fadeUp} className="mt-4 flex justify-center">
            <StoreSourceBadge source={source} degraded={degraded} mode={mode} />
          </motion.div>

          {notice ? (
            <motion.p
              variants={fadeUp}
              className="mt-3 text-center text-xs text-muted/60"
            >
              {notice}
            </motion.p>
          ) : null}

          {/* 门店列表 */}
          <motion.div variants={fadeUp} className="mt-4 space-y-3">
            {status === "loading" && stores.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">正在查询门店…</p>
            ) : null}

            {stores.map((store) => (
              <StoreCard
                key={store.storeCode}
                store={store}
                active={store.storeCode === selectedCode}
                onSelect={() => choose(store)}
              />
            ))}
          </motion.div>

          {/* 跳过 */}
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={() => router.push("/recommend/")}
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              跳过，使用默认门店 →
            </button>
            <button
              type="button"
              onClick={() => router.push("/result/")}
              className="text-[11px] text-muted/60 transition-colors hover:text-foreground"
            >
              返回人格结果
            </button>
          </motion.div>
        </motion.div>
      </ScreenShell>
    </>
  );
}

/** 营业状态徽标。必须区分「已打烊」与「状态未知」——后者不能当作打烊。 */
function BusinessBadge({ status }: { status: boolean | null }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-300">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        营业中
      </span>
    );
  }

  if (status === false) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10px] text-muted">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted/50" />
        已打烊
      </span>
    );
  }

  // 收藏门店不返回该字段 —— 如实显示「未知」，不猜
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted/60"
      title="该搜索方式未返回营业状态"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted/30" />
      状态未知
    </span>
  );
}

function StoreCard({
  store,
  active,
  onSelect,
}: {
  store: ProviderStore;
  active: boolean;
  onSelect: () => void;
}) {
  const distance =
    store.distance != null
      ? store.distance < 1000
        ? `${Math.round(store.distance)} m`
        : `${(store.distance / 1000).toFixed(1)} km`
      : null;

  const hours =
    store.businessStartTime && store.businessEndTime
      ? `${store.businessStartTime}–${store.businessEndTime}`
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "glass w-full rounded-[24px] p-4 text-left transition-colors",
        active ? "border-brand-yellow/45" : "hover:border-white/25",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-snug text-foreground">
          {store.storeName}
        </p>
        <BusinessBadge status={store.businessStatus} />
      </div>

      {store.address ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          {store.address}
        </p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted/70">
        <span className="tabular-nums">
          门店编码 <span className="text-muted">{store.storeCode}</span>
        </span>
        {distance ? <span>{distance}</span> : null}
        {hours ? <span className="tabular-nums">{hours}</span> : null}
        {active ? <span className="text-brand-yellow">✓ 当前选择</span> : null}
      </div>

      {store.hoursText ? (
        <p className="mt-2 border-t border-white/[0.08] pt-2 text-[11px] leading-relaxed text-muted/60">
          {store.hoursText}
        </p>
      ) : null}
    </button>
  );
}

function StoreSourceBadge({
  source,
  degraded,
  mode,
}: {
  source: DataSource;
  degraded: boolean;
  mode: "favorites" | "search";
}) {
  const isLive = source === "mcp";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={[
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px]",
          isLive
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : "border-amber-400/25 bg-amber-400/10 text-amber-200/90",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"}`}
        />
        {isLive ? "实时数据" : degraded ? "演示数据 · 后端未连接" : "演示数据"}
        <span className="text-muted/50">·</span>
        {mode === "search" ? "城市搜索" : "收藏门店"}
      </span>
    </div>
  );
}
