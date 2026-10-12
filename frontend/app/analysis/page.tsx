"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AnalysisAnimation } from "@/components/AnalysisAnimation";
import { GradientBackground } from "@/components/GradientBackground";
import { ScreenShell } from "@/components/ScreenShell";
import { buildProfile } from "@/data/mockProfile";
import { deriveContext, isComplete, scoreAnswers } from "@/lib/scoring";
import { readAnswers, savePersona, saveProfile } from "@/lib/store";

/**
 * AI 分析页。
 *
 * 这是全站唯一计算并保存人格的位置：
 *   读取 answers → scoreAnswers() → savePersona() + saveProfile() → /result/
 *
 * 无作答或作答不完整时，直接退回测试页，避免出现空白结果。
 */
export default function AnalysisPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // 进入时先校验作答是否完整
  useEffect(() => {
    const answers = readAnswers();
    if (!answers || !isComplete(answers)) {
      router.replace("/personality/");
      return;
    }
    setReady(true);
  }, [router]);

  const handleComplete = useCallback(() => {
    const answers = readAnswers();
    if (!answers || !isComplete(answers)) {
      router.replace("/personality/");
      return;
    }

    const result = scoreAnswers(answers);
    savePersona(result);
    saveProfile(buildProfile(result.code, deriveContext(answers)));

    // replace 而非 push：避免用户后退时又回到播完的动画页
    router.replace("/result/");
  }, [router]);

  return (
    <>
      <GradientBackground />
      <ScreenShell center maxWidth="lg">
        {ready ? (
          <AnalysisAnimation onComplete={handleComplete} />
        ) : (
          // 校验作答期间的一帧占位，避免完全空白
          <p className="text-sm text-muted">正在准备…</p>
        )}
      </ScreenShell>
    </>
  );
}
