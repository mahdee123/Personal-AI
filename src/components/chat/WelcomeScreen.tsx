"use client";

import { SparkIcon } from "@/components/ui/Icons";
import { MODEL_LABEL, SUGGESTED_PROMPTS, USER_NAME } from "@/lib/constants";

export function WelcomeScreen({
  onSelectPrompt,
}: {
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-3xl text-center">
        <span className="mx-auto mb-6 flex size-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-accent-soft">
          <SparkIcon className="size-6" />
        </span>

        <h2 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
          How can I help you, {USER_NAME}?
        </h2>

        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-6 text-muted">
          This is your private personal AI workspace. Everything runs locally on
          your own machine through {MODEL_LABEL} — no accounts, no cloud, and
          nothing you type ever leaves this computer.
        </p>

        <div className="mt-9 grid gap-3 text-left sm:grid-cols-2">
          {SUGGESTED_PROMPTS.map((suggestion) => (
            <button
              key={suggestion.title}
              type="button"
              onClick={() => onSelectPrompt(suggestion.prompt)}
              className="group rounded-xl border border-line bg-surface/60 p-4 transition hover:border-accent/40 hover:bg-surface-2"
            >
              <p className="text-[14px] font-medium text-ink">
                {suggestion.title}
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-faint">
                {suggestion.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
