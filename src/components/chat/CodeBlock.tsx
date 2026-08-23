"use client";

import { Children, isValidElement, useRef, useState, type ReactNode } from "react";

import { CheckIcon, CopyIcon } from "@/components/ui/Icons";

/** Reads `language-xxx` off the inner <code> element rendered by rehype-highlight. */
function detectLanguage(children: ReactNode): string {
  const child = Children.toArray(children)[0];

  if (!isValidElement<{ className?: string }>(child)) return "code";

  const match = /language-([\w+-]+)/.exec(child.props.className ?? "");
  return match?.[1] ?? "code";
}

/**
 * Replaces the default <pre> in Markdown output with a titled block that has a
 * working copy button. Copy reads the DOM text so it always matches what the
 * user actually sees, highlighting markup included.
 */
export function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = preRef.current?.textContent ?? "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context) — leave the button state untouched.
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-line bg-[#0d0d11]">
      <div className="flex items-center justify-between border-b border-line-soft bg-surface-2/60 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          {detectLanguage(children)}
        </span>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted transition hover:bg-surface-3 hover:text-ink"
        >
          {copied ? (
            <>
              <CheckIcon className="size-3.5 text-online" />
              Copied
            </>
          ) : (
            <>
              <CopyIcon className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      <pre ref={preRef} className="overflow-x-auto p-4 font-mono">
        {children}
      </pre>
    </div>
  );
}
