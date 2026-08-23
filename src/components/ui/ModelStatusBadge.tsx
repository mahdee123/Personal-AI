"use client";

import { useModelStatus } from "@/hooks/useModelStatus";
import { cn } from "@/lib/utils";

/**
 * Header indicator for the local Ollama connection.
 * Click to re-check immediately instead of waiting for the next poll.
 */
export function ModelStatusBadge({ isGenerating }: { isGenerating?: boolean }) {
  const { status, isChecking, refresh } = useModelStatus(isGenerating);

  const state = isChecking && status.models.length === 0
    ? "checking"
    : status.online && status.modelAvailable
      ? "online"
      : status.online
        ? "warning"
        : "offline";

  const label = {
    checking: "Checking…",
    online: "Local AI online",
    warning: "Model missing",
    offline: "Local AI offline",
  }[state];

  const dotClass = {
    checking: "bg-faint",
    online: "bg-online",
    warning: "bg-amber-400",
    offline: "bg-offline",
  }[state];

  const textClass = {
    checking: "text-faint border-line",
    online: "text-online border-online/25 bg-online/10",
    warning: "text-amber-300 border-amber-400/25 bg-amber-400/10",
    offline: "text-offline border-offline/25 bg-offline/10",
  }[state];

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      title={`${status.message} (click to re-check)`}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80",
        textClass,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          dotClass,
          state === "checking" && "thinking-dot",
        )}
      />
      {label}
    </button>
  );
}
