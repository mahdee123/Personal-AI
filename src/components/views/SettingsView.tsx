"use client";

import { useState } from "react";

import { useWorkspace } from "@/context/WorkspaceProvider";
import { useModelStatus } from "@/hooks/useModelStatus";
import { MODEL_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  onLabel,
  offLabel,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-[13px] text-muted"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-all",
            checked ? "left-4.5" : "left-0.5",
          )}
        />
      </span>
      {checked ? onLabel : offLabel}
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-[15px] font-medium text-ink">{title}</h3>
      <p className="mt-1 text-[13px] leading-5 text-faint">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsView() {
  const { settings, updateSettings, conversations, clearAllConversations } =
    useWorkspace();
  const { status, refresh, isChecking } = useModelStatus();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const messageCount = conversations.reduce(
    (total, conversation) => total + conversation.messages.length,
    0,
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <header className="mb-2">
          <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
          <p className="mt-1 text-[13px] text-muted">
            These preferences are stored locally in this browser.
          </p>
        </header>

        <Section
          title="Speed"
          description="Deep thinking lets the model reason at length before answering. It produces better plans and critiques, but generates several times as many tokens — which is slow on CPU-only machines."
        >
          <Toggle
            checked={settings.deepThinking}
            onChange={(value) => updateSettings({ deepThinking: value })}
            onLabel="Deep thinking — slower, more thorough"
            offLabel="Fast replies — recommended"
          />

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="num-predict-select"
                className="block text-[13px] text-faint"
              >
                Max response length
              </label>
              <select
                id="num-predict-select"
                value={settings.numPredict}
                onChange={(event) =>
                  updateSettings({ numPredict: Number(event.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent/50"
              >
                <option value={512}>Short (512 tokens)</option>
                <option value={1024}>Medium (1024 tokens)</option>
                <option value={2048}>Long (2048 tokens)</option>
                <option value={4096}>Very long (4096 tokens)</option>
                <option value={0}>Unlimited</option>
              </select>
              <p className="mt-1.5 text-[12px] leading-5 text-faint">
                Shorter responses generate faster. Unlimited lets the model
                decide when to stop.
              </p>
            </div>

            <div>
              <label
                htmlFor="context-messages-select"
                className="block text-[13px] text-faint"
              >
                Context window
              </label>
              <select
                id="context-messages-select"
                value={settings.contextMessages}
                onChange={(event) =>
                  updateSettings({
                    contextMessages: Number(event.target.value),
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent/50"
              >
                <option value={5}>5 messages — fastest</option>
                <option value={10}>10 messages — balanced</option>
                <option value={16}>16 messages — more context</option>
              </select>
              <p className="mt-1.5 text-[12px] leading-5 text-faint">
                Fewer messages means the model reads less history before
                answering, which speeds up the response.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Local model"
          description="Mahdee AI talks to Ollama on your machine through the app's own /api/chat route."
        >
          <label className="block text-[13px] text-faint" htmlFor="model-select">
            Model
          </label>
          <select
            id="model-select"
            value={settings.model}
            onChange={(event) => updateSettings({ model: event.target.value })}
            className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent/50"
          >
            {(status.models.length > 0 ? status.models : [settings.model]).map(
              (name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ),
            )}
          </select>

          <p className="mt-2 text-[12px] leading-5 text-faint">
            Smaller models reply faster. To add one, run{" "}
            <code className="rounded bg-surface-3 px-1 py-0.5 font-mono">
              ollama pull qwen3:4b
            </code>{" "}
            and it will appear here.
          </p>

          <dl className="mt-4 space-y-2.5 border-t border-line-soft pt-4 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-faint">Default</dt>
              <dd className="font-mono text-ink">{MODEL_LABEL}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-faint">Connection</dt>
              <dd
                className={cn(
                  "font-medium",
                  status.online ? "text-online" : "text-offline",
                )}
              >
                {status.online ? "Connected" : "Not reachable"}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[12px] leading-5 text-faint">{status.message}</p>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isChecking}
            className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-muted transition hover:text-ink disabled:opacity-50"
          >
            {isChecking ? "Checking…" : "Re-check connection"}
          </button>
        </Section>

        <Section
          title="Response style"
          description="Lower values keep answers focused and consistent. Higher values make them more exploratory."
        >
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.1}
              value={settings.temperature}
              onChange={(event) =>
                updateSettings({ temperature: Number(event.target.value) })
              }
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
            />
            <span className="w-10 text-right font-mono text-[13px] text-ink">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
        </Section>

        <Section
          title="Custom instructions"
          description="Added to the Mahdee AI system prompt on every request — context about you, your work, or how you want replies written."
        >
          <textarea
            value={settings.customInstructions}
            onChange={(event) =>
              updateSettings({ customInstructions: event.target.value })
            }
            rows={5}
            placeholder="e.g. I design B2B SaaS dashboards. Prefer British spelling and keep answers under 300 words unless I ask for depth."
            className="w-full resize-y rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[14px] leading-6 text-ink outline-none transition placeholder:text-faint focus:border-accent/50"
          />
        </Section>

        <Section
          title="Image generation"
          description="Generate images from text prompts using a local FLUX.1-schnell model running via a Python sidecar."
        >
          <Toggle
            checked={settings.imageGenerationEnabled}
            onChange={(value) => updateSettings({ imageGenerationEnabled: value })}
            onLabel="Enabled"
            offLabel="Disabled"
          />

          <div className="mt-3">
            <label
              htmlFor="image-gen-url"
              className="block text-[13px] text-faint"
            >
              Sidecar URL
            </label>
            <input
              id="image-gen-url"
              type="text"
              value={settings.imageGenerationUrl}
              onChange={(event) =>
                updateSettings({ imageGenerationUrl: event.target.value })
              }
              placeholder="http://localhost:8000"
              className="mt-1.5 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-[13px] text-ink outline-none transition focus:border-accent/50"
            />
            <p className="mt-1.5 text-[12px] leading-5 text-faint">
              Run <code className="rounded bg-surface-3 px-1 py-0.5 font-mono">python-server/start.bat</code> to start the local image generation service.
            </p>
          </div>
        </Section>

        <Section
          title="Show reasoning"
          description="When deep thinking is on, display the model's chain-of-thought above each reply in a collapsed panel."
        >
          <Toggle
            checked={settings.showReasoning}
            onChange={(value) => updateSettings({ showReasoning: value })}
            onLabel="Shown"
            offLabel="Hidden"
          />
        </Section>

        <Section
          title="Local data"
          description="Conversations live in this browser's localStorage. Nothing is uploaded anywhere."
        >
          <p className="text-[13px] text-muted">
            {conversations.length} conversation
            {conversations.length === 1 ? "" : "s"} · {messageCount} message
            {messageCount === 1 ? "" : "s"} stored
          </p>

          {confirmingClear ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-offline">
                Delete all conversations permanently?
              </span>
              <button
                type="button"
                onClick={() => {
                  clearAllConversations();
                  setConfirmingClear(false);
                }}
                className="rounded-lg bg-offline/15 px-3 py-1.5 text-[13px] font-medium text-offline transition hover:bg-offline/25"
              >
                Yes, delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted transition hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={conversations.length === 0}
              className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-muted transition hover:border-offline/40 hover:text-offline disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
            >
              Clear all conversations
            </button>
          )}
        </Section>
      </div>
    </div>
  );
}
