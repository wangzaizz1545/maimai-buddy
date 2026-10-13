"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 主按钮。
 *
 * 同时支持两种形态：
 *   - 传 href → 渲染为 Next.js 的 Link（用于站内跳转）
 *   - 传 onClick → 渲染为原生 button
 *
 * 注意：站内跳转路径一律使用带尾斜杠的形式（如 /personality/），
 * 因为项目开启了 trailingSlash，静态服务器才能正确命中目录下的 index.html。
 */

const VARIANTS = {
  primary:
    "bg-brand-red text-white shadow-lg shadow-brand-red/25 hover:brightness-110",
  ghost:
    "border border-white/[0.12] bg-white/5 text-foreground hover:bg-white/10",
} as const;

const SIZES = {
  md: "px-6 py-3 text-sm",
  lg: "px-9 py-3.5 text-base",
} as const;

type Props = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  className?: string;
};

export function PrimaryButton({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "lg",
  disabled = false,
  className = "",
}: Props) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold",
    "transition duration-200 active:scale-[0.98]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    return (
      <Link href={href} className={classes} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
