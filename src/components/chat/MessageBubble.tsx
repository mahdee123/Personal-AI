"use client";

import { useState } from "react";

import { MarkdownMessage } from "@/components/chat/MarkdownMessage";
import { ReasoningPanel } from "@/components/chat/ReasoningPanel";
import { CheckIcon, CopyIcon, PaperclipIcon, SparkIcon } from "@/components/ui/Icons";
import { useWorkspace } from "@/context/WorkspaceProvider";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-faint opacity-0 transition hover:bg-surface-2 hover:text-muted focus-visible:opacity-100 group-hover:opacity-100"
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5 text-online" /> Copied
        </>
      ) : (
        <>
          <CopyIcon className="size-3.5" /> Copy
        </>
      )}
    </button>
  );
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { settings } = useWorkspace();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="fade-in flex justify-end">
        <div className="max-w-[85%] sm:max-w-[75%]">
          {/* Attached images */}
          {message.images && message.images.length > 0 && (
            <>
              <div className="mb-2 flex flex-wrap justify-end gap-2">
                {message.images.map((base64, index) => (
                  <img
                    key={index}
                    src={`data:image/png;base64,${base64}`}
                    alt={`Attached image ${index + 1}`}
                    className="max-h-48 rounded-xl object-cover"
                  />
                ))}
              </div>
              <p className="mb-2 text-right text-[11px] text-faint">
                Images require a vision model (e.g. qwen3-vl:8b)
              </p>
            </>
          )}

          {/* File attachment indicator */}
          {message.fileAttachment && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-line-soft bg-surface-2/60 px-3 py-2 text-[12px] text-muted">
              <PaperclipIcon className="size-3.5 shrink-0" />
              <span className="truncate">{message.fileAttachment.name}</span>
            </div>
          )}

          <div className="rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap break-words text-ink">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in group flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          message.isError
            ? "bg-offline/15 text-offline"
            : "bg-accent/15 text-accent-soft",
        )}
      >
        <SparkIcon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {message.isError ? (
          <div className="rounded-xl border border-offline/25 bg-offline/10 px-4 py-3 text-[14px] leading-6 text-offline">
            {message.content}
          </div>
        ) : (
          <>
            {settings.showReasoning && message.reasoning && (
              <ReasoningPanel reasoning={message.reasoning} />
            )}

            {/* Generated image */}
            {message.generatedImage && (
              <div className="mb-3">
                <img
                  src={`data:image/png;base64,${message.generatedImage}`}
                  alt="Generated image"
                  className="max-w-full rounded-xl border border-line"
                />
              </div>
            )}

            <MarkdownMessage content={message.content} />
            <div className="mt-1.5 -ml-2">
              <CopyButton text={message.content} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
