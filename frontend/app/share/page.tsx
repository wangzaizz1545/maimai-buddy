"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { GradientBackground } from "@/components/GradientBackground";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { SharePoster } from "@/components/SharePoster";
import { buildProfile } from "@/data/mockProfile";
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import { deriveContext } from "@/lib/scoring";
import { readAnswers, readPersona, readProfile } from "@/lib/store";
import { themeOf } from "@/lib/theme";
import type { BuddyProfile, Persona, PersonaResult } from "@/lib/types";

/**
 * 分享卡页。
 *
 * 产出两种可直接使用的分享物：
 *   1. PNG 图片（前端 DOM → canvas，3 倍像素输出，可直接发朋友圈或放进 README）
 *   2. 纯文本分享文案（一键复制）
 *
 * html-to-image 采用动态 import，不进入首屏包体。
 */

type ShareState = {
  persona: Persona;
  result: PersonaResult;
  profile: BuddyProfile;
  mood: string | null;
};

export default function SharePage() {
  const router = useRouter();

  const [state, setState] = useState<ShareState | null>(null);
  const [checked, setChecked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const result = readPersona();
    if (!result) {
      router.replace("/personality/");
      return;
    }

    const persona = getPersona(result.code) ?? DEFAULT_PERSONA;
    const answers = readAnswers();
    const context = answers ? deriveContext(answers) : null;

    setState({
      persona,
      result,
      profile: readProfile() ?? buildProfile(persona.code, context ?? undefined),
      mood: context?.mood ?? null,
    });
    setChecked(true);
  }, [router]);

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板不可用（非安全上下文等）时静默失败，不打断流程
    }
  }

  async function handleDownload(code: string) {
    const node = posterRef.current;
    if (!node || exporting) return;

    setExporting(true);
    setExportFailed(false);

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(node, {
        pixelRatio: 3, // 约 1150×1536，足够朋友圈与 README 使用
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `mcbuddy-${code}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // 导出失败时引导用户改用截图，不阻断流程
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  }

  if (!checked || !state) {
    return (
      <>
        <GradientBackground />
        <ScreenShell center maxWidth="lg">
          <p className="text-sm text-muted">正在生成你的卡片…</p>
        </ScreenShell>
      </>
    );
  }

  const theme = themeOf(state.persona);

  return (
    <>
      <GradientBackground from={theme.from} to={theme.to} />

      <ScreenShell maxWidth="lg">
        <p className="mb-6 text-center text-xs font-semibold tracking-[0.2em] text-brand-yellow/80">
          分享卡片
        </p>

        {/* 海报（导出目标） */}
        <div ref={posterRef} className="mx-auto w-full max-w-sm">
          <SharePoster
            persona={state.persona}
            result={state.result}
            profile={state.profile}
            mood={state.mood}
          />
        </div>

        <p className="mt-5 text-center text-xs text-muted/60">
          保存后可直接发朋友圈，或放进 README 展示
        </p>

        {/* 行动点 */}
        <div className="mt-7 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <PrimaryButton
              onClick={() => handleDownload(state.persona.code)}
              disabled={exporting}
              size="md"
            >
              {exporting ? "生成中…" : "保存图片"}
            </PrimaryButton>

            <PrimaryButton
              onClick={() => handleCopy(state.persona.shareText)}
              variant="ghost"
              size="md"
            >
              {copied ? "已复制 ✓" : "复制文案"}
            </PrimaryButton>
          </div>

          {exportFailed ? (
            <p className="text-xs text-brand-yellow/80">
              导出失败，请直接长按或截图保存
            </p>
          ) : null}

          <div className="mt-1 flex items-center gap-5">
            <button
              type="button"
              onClick={() => router.push("/buddy/")}
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              麦友档案
            </button>
            <button
              type="button"
              onClick={() => router.push("/result/")}
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              返回结果
            </button>
          </div>
        </div>
      </ScreenShell>
    </>
  );
}
