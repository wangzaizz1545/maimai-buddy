/**
 * 测试进度指示。
 *
 * 同时承担两件事（按页面规格）：
 *   1. 圆点进度：当前项为拉长的胶囊，已完成项为半透明，未开始项为灰点
 *   2. 题号计数：可选的「当前 / 总数」
 */
type Props = {
  total: number;
  /** 0-based 当前下标 */
  current: number;
  /** 是否在右侧显示「当前 / 总数」 */
  showCounter?: boolean;
  className?: string;
};

export function StepDots({
  total,
  current,
  showCounter = false,
  className = "",
}: Props) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={[
              "h-1.5 rounded-full transition-all duration-300",
              i === current
                ? "w-6 bg-gradient-to-r from-brand-yellow to-brand-orange"
                : i < current
                  ? "w-1.5 bg-brand-yellow/50"
                  : "w-1.5 bg-white/15",
            ].join(" ")}
          />
        ))}
      </div>

      {showCounter ? (
        <span className="text-xs tabular-nums text-muted">
          {current + 1} / {total}
        </span>
      ) : null}
    </div>
  );
}
