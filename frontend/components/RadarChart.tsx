"use client";

import { motion } from "framer-motion";

import { DIMENSIONS } from "@/data/questions";
import type { PersonaVector } from "@/lib/types";

/**
 * 六维人格雷达图。
 *
 * 刻意手写 SVG 而不引入图表库：
 *   - 六边形雷达本身只有几十行几何运算
 *   - 图表库会带来几十 KB 体积和难以覆盖的默认样式
 *   - 手写可以完全控制配色与动画，与整体设计语言一致
 */

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

type Props = {
  vector: PersonaVector;
  /** SVG 用户坐标系尺寸（会按父容器等比缩放） */
  size?: number;
  accent?: string;
  animated?: boolean;
  className?: string;
};

export function RadarChart({
  vector,
  size = 280,
  accent = "#FFC72C",
  animated = true,
  className = "",
}: Props) {
  const center = size / 2;
  const radius = size * 0.31;
  const labelRadius = radius + size * 0.14;
  const count = DIMENSIONS.length;

  const angleAt = (i: number) => (-90 + (360 / count) * i) * (Math.PI / 180);

  const pointAt = (i: number, r: number): [number, number] => [
    center + r * Math.cos(angleAt(i)),
    center + r * Math.sin(angleAt(i)),
  ];

  const toPolygon = (r: number) =>
    DIMENSIONS.map((_, i) => pointAt(i, r).join(",")).join(" ");

  /** 网格层级 */
  const levels = [0.25, 0.5, 0.75, 1];

  /** 实际数值多边形 */
  const valuePoints = DIMENSIONS.map((d, i) =>
    pointAt(i, radius * clamp01(vector[d.key] ?? 0))
  );
  const valuePolygon = valuePoints.map((p) => p.join(",")).join(" ");

  const motionProps = animated
    ? {
        initial: { scale: 0.2, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const, delay: 0.15 },
      }
    : {};

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={`h-auto max-w-full ${className}`}
      role="img"
      aria-label="六维人格雷达图"
    >
      {/* 网格 */}
      {levels.map((level) => (
        <polygon
          key={level}
          points={toPolygon(radius * level)}
          fill="none"
          stroke="rgb(255 255 255 / 0.09)"
          strokeWidth={1}
        />
      ))}

      {/* 轴线 */}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pointAt(i, radius);
        return (
          <line
            key={d.key}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgb(255 255 255 / 0.07)"
            strokeWidth={1}
          />
        );
      })}

      {/* 数值区域 */}
      <motion.g
        {...motionProps}
        style={{
          transformOrigin: `${center}px ${center}px`,
          transformBox: "view-box",
        }}
      >
        <polygon
          points={valuePolygon}
          fill={accent}
          fillOpacity={0.22}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {valuePoints.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill={accent} />
        ))}
      </motion.g>

      {/* 维度标签 */}
      {DIMENSIONS.map((d, i) => {
        const [x, y] = pointAt(i, labelRadius);
        const dx = x - center;
        const anchor = Math.abs(dx) < 1 ? "middle" : dx > 0 ? "start" : "end";
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={size * 0.046}
            fill="rgb(161 161 166)"
            fontWeight={500}
          >
            {d.short}
          </text>
        );
      })}
    </svg>
  );
}
