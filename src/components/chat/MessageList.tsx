"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/MessageBubble";
import { SparkIcon } from "@/components/ui/Icons";
import type { ChatMessage } from "@/lib/types";

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
        <SparkIcon className="size-4" />
      </span>

      <div className="flex items-center gap-2 pt-1.5 text-[13px] text-faint">
        <span className="flex gap-1">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="thinking-dot size-1.5 rounded-full bg-accent-soft"
              style={{ animationDelay: `${index * 0.16}s` }}
            />
          ))}
        </span>
        Mahdee AI is thinking…
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  isGenerating,
}: {
  messages: ChatMessage[];
  isGenerating: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const last = messages[messages.length - 1];
  // The assistant turn exists but is still empty until the first token lands.
  const isWaitingForFirstToken =
    isGenerating && (!last || last.role === "user" || last.content.length === 0);

  // Auto-scroll as tokens stream in and when the thinking state toggles.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isGenerating]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-7 px-4 py-8 sm:px-6">
        {messages.map((message) =>
          message.content.length === 0 ? null : (
            <MessageBubble key={message.id} message={message} />
          ),
        )}

        {isWaitingForFirstToken && <ThinkingIndicator />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
