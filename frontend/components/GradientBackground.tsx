/**
 * 渐变光晕背景。
 *
 * 两个大范围模糊色块缓慢呼吸，为深色页面提供「AI 感」，
 * 同时可通过 from / to 切换成任意人格的专属配色。
 */
type Props = {
  from?: string;
  to?: string;
  /** 整体强度 0–1 */
  intensity?: number;
};

export function GradientBackground({
  from = "#DA291C",
  to = "#FFC72C",
  intensity = 0.22,
}: Props) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* 顶部主光晕 */}
      <div
        className="absolute left-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 animate-breathe rounded-full blur-[130px]"
        style={{
          background: `radial-gradient(circle, ${from} 0%, transparent 70%)`,
          opacity: intensity,
        }}
      />
      {/* 右下副光晕 */}
      <div
        className="absolute bottom-[-16rem] right-[-10rem] h-[30rem] w-[30rem] animate-breathe rounded-full blur-[130px] [animation-delay:2s]"
        style={{
          background: `radial-gradient(circle, ${to} 0%, transparent 70%)`,
          opacity: intensity * 0.75,
        }}
      />
    </div>
  );
}
