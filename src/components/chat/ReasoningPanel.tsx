"use client";

import { useState } from "react";

import { BrainIcon, ChevronIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";

/**
 * qwen3 is a reasoning model, so replies can carry a separate chain-of-thought.
 * It is collapsed by default and never sent back to the model as context.
 */
export function ReasoningPanel({ reasoning }: { reasoning: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-line-soft bg-surface-2/50">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-faint transition hover:text-muted"
      >
        <BrainIcon className="size-3.5" />
        Model reasoning
        <ChevronIcon
          className={cn("ml-auto size-3.5 transition-transform", isOpen && "rotate-90")}
        />
      </button>

      {isOpen && (
        <p className="whitespace-pre-wrap border-t border-line-soft px-3 py-2.5 font-mono text-[12px] leading-6 text-faint">
          {reasoning}
        </p>
      )}
    </div>
  );
}
