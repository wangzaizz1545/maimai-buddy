"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BuddyProfile } from "@/components/BuddyProfile";
import { GradientBackground } from "@/components/GradientBackground";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ScreenShell } from "@/components/ScreenShell";
import { buildProfile } from "@/data/mockProfile";
import { DEFAULT_PERSONA, getPersona } from "@/data/personas";
import { readPersona, readProfile } from "@/lib/store";
import { themeOf } from "@/lib/theme";
import type { BuddyProfile as BuddyProfileData, Persona } from "@/lib/types";

/**
 * 麦友档案页。
 *
 * 数据全部来自 lib/store 与 data/mockProfile，本页不做任何推导。
 * 没有测试结果时不跳走，而是用默认人格渲染 + 顶部提示——
 * 这样直接访问该页也能看到档案长什么样（对评委更友好）。
 */

type PageState = {
  persona: Persona;
  profile: BuddyProfileData;
  hasResult: boolean;
};

export default function BuddyPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState | null>(null);

  useEffect(() => {
    const result = readPersona();
    const persona = getPersona(result?.code) ?? DEFAULT_PERSONA;

    setState({
      persona,
      profile: readProfile() ?? buildProfile(persona.code),
      hasResult: Boolean(result),
    });
  }, []);

  if (!state) {
    return (
      <>
        <GradientBackground />
        <ScreenShell center maxWidth="lg">
          <p className="text-sm text-muted">正在读取麦友档案…</p>
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
          你的麦友档案
        </p>

        {/* 未测试时的提示 */}
        {!state.hasResult ? (
          <div className="glass mb-4 rounded-2xl px-5 py-4 text-center text-xs text-muted">
            你还没有做过测试，下面是示例档案。
          </div>
        ) : null}

        <BuddyProfile persona={state.persona} profile={state.profile} />

        {/* 行动点 */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {state.hasResult ? (
            <PrimaryButton href="/share/" size="md">
              生成分享卡片
            </PrimaryButton>
          ) : (
            <PrimaryButton href="/personality/" size="md">
              开始麦门人格测试
            </PrimaryButton>
          )}

          <button
            type="button"
            onClick={() => router.push(state.hasResult ? "/result/" : "/")}
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            {state.hasResult ? "返回结果" : "回到首页"}
          </button>
        </div>
      </ScreenShell>
    </>
  );
}
