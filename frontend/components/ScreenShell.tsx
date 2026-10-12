import type { ReactNode } from "react";

/**
 * 页面外壳：统一内边距、最大宽度与移动端视口高度。
 *
 * 使用 min-h-[100dvh] 而不是 100vh —— 移动端浏览器工具栏会吃掉 100vh，
 * 导致内容被裁切。
 */

const MAX_WIDTH = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  full: "max-w-none",
} as const;

type Props = {
  children: ReactNode;
  /** 是否垂直居中（首页、分析页需要） */
  center?: boolean;
  maxWidth?: keyof typeof MAX_WIDTH;
  className?: string;
};

export function ScreenShell({
  children,
  center = false,
  maxWidth = "xl",
  className = "",
}: Props) {
  return (
    <main
      className={[
        "relative min-h-[100dvh] w-full px-5 py-12 sm:px-6",
        center ? "flex flex-col items-center justify-center" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`mx-auto w-full ${MAX_WIDTH[maxWidth]}`}>{children}</div>
    </main>
  );
}
