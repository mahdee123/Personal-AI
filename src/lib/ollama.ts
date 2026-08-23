/**
 * Server-side client for the local Ollama HTTP API.
 * Only ever imported from route handlers — never from client components.
 */

import {
  OLLAMA_BASE_URL,
  OLLAMA_KEEP_ALIVE,
  OLLAMA_TIMEOUT_MS,
} from "@/lib/config";
import type { ChatErrorCode } from "@/lib/types";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** Present on reasoning models when Ollama separates the thinking stream. */
  thinking?: string;
  /** Base64-encoded images for vision models (e.g. qwen3-vl). */
  images?: string[];
}

interface OllamaStreamChunk {
  message?: OllamaMessage;
  done?: boolean;
  total_duration?: number;
  error?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

export class OllamaError extends Error {
  readonly code: ChatErrorCode;
  readonly status: number;

  constructor(code: ChatErrorCode, message: string, status: number) {
    super(message);
    this.name = "OllamaError";
    this.code = code;
    this.status = status;
  }
}

export const OLLAMA_OFFLINE_MESSAGE =
  "Unable to connect to the local AI model. Please make sure Ollama is running.";

/** Turns a thrown fetch/abort error into a typed, user-readable OllamaError. */
function toOllamaError(error: unknown): OllamaError {
  if (error instanceof OllamaError) return error;

  if (error instanceof DOMException || error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return new OllamaError(
        "timeout",
        `The local model took longer than ${Math.round(
          OLLAMA_TIMEOUT_MS / 1000,
        )}s to respond. Try a shorter prompt or a smaller model.`,
        504,
      );
    }
  }

  return new OllamaError("ollama_unreachable", OLLAMA_OFFLINE_MESSAGE, 503);
}

async function ollamaFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetch(`${OLLAMA_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw toOllamaError(error);
  }
}

/** Longest suffix of `text` that could be the start of `tag`. */
function partialTagLength(text: string, tag: string): number {
  const max = Math.min(tag.length - 1, text.length);

  for (let length = max; length > 0; length -= 1) {
    if (tag.startsWith(text.slice(text.length - length))) return length;
  }

  return 0;
}

const OPEN_TAG = "<think>";
const CLOSE_TAG = "</think>";

/**
 * Some models inline their chain-of-thought as <think>…</think> instead of
 * using Ollama's separate `thinking` field. This splits a token stream into
 * visible content and reasoning, holding back partial tags that straddle a
 * chunk boundary.
 */
export function createReasoningSplitter() {
  let inThink = false;
  let buffer = "";

  return function push(chunk: string): { content: string; reasoning: string } {
    buffer += chunk;

    let content = "";
    let reasoning = "";

    while (buffer.length > 0) {
      const tag = inThink ? CLOSE_TAG : OPEN_TAG;
      const index = buffer.indexOf(tag);

      if (index === -1) {
        const held = partialTagLength(buffer, tag);
        const emit = buffer.slice(0, buffer.length - held);

        if (inThink) reasoning += emit;
        else content += emit;

        buffer = buffer.slice(buffer.length - held);
        break;
      }

      if (inThink) reasoning += buffer.slice(0, index);
      else content += buffer.slice(0, index);

      buffer = buffer.slice(index + tag.length);
      inThink = !inThink;
    }

    return { content, reasoning };
  };
}

export interface StreamEvent {
  type: "delta" | "reasoning" | "done";
  text?: string;
  durationMs?: number | null;
}

/**
 * Streams a chat completion. Yields token deltas as they are produced so the
 * UI can render text immediately instead of waiting for the full reply — which
 * matters a lot on CPU-only inference.
 */
export async function* streamChatCompletion(options: {
  model: string;
  messages: OllamaMessage[];
  temperature: number;
  think: boolean;
  numPredict?: number;
  signal?: AbortSignal;
}): AsyncGenerator<StreamEvent> {
  const ollamaOptions: Record<string, unknown> = {
    temperature: options.temperature,
  };
  if (typeof options.numPredict === "number" && options.numPredict > 0) {
    ollamaOptions.num_predict = options.numPredict;
  }

  const response = await ollamaFetch(
    "/api/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        think: options.think,
        keep_alive: OLLAMA_KEEP_ALIVE,
        options: ollamaOptions,
      }),
    },
    OLLAMA_TIMEOUT_MS,
  );

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");

    if (response.status === 404) {
      throw new OllamaError(
        "model_missing",
        `The model "${options.model}" is not installed in Ollama. Run: ollama pull ${options.model}`,
        404,
      );
    }

    throw new OllamaError(
      "upstream_error",
      `Ollama returned an error (${response.status}). ${detail.slice(0, 300)}`.trim(),
      502,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const split = createReasoningSplitter();

  let pending = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });

      // Ollama streams newline-delimited JSON objects.
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;

        let chunk: OllamaStreamChunk;

        try {
          chunk = JSON.parse(trimmed) as OllamaStreamChunk;
        } catch {
          continue;
        }

        if (chunk.error) {
          throw new OllamaError("upstream_error", chunk.error, 502);
        }

        const thinking = chunk.message?.thinking;
        if (thinking) yield { type: "reasoning", text: thinking };

        const raw = chunk.message?.content;
        if (raw) {
          const { content, reasoning } = split(raw);
          if (reasoning) yield { type: "reasoning", text: reasoning };
          if (content) yield { type: "delta", text: content };
        }

        if (chunk.done) {
          yield {
            type: "done",
            durationMs:
              typeof chunk.total_duration === "number"
                ? Math.round(chunk.total_duration / 1_000_000)
                : null,
          };
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

/**
 * Asks Ollama to load the model into memory without generating anything.
 * Called on every health poll, which also refreshes the keep-alive timer so the
 * model stays resident while the app is open.
 */
export async function preloadModel(model: string): Promise<void> {
  await ollamaFetch(
    "/api/generate",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: "", keep_alive: OLLAMA_KEEP_ALIVE }),
    },
    OLLAMA_TIMEOUT_MS,
  );
}

/** Lists installed models. Used by the status indicator and model picker. */
export async function listModels(): Promise<string[]> {
  const response = await ollamaFetch("/api/tags", { method: "GET" }, 5_000);

  if (!response.ok) {
    throw new OllamaError(
      "upstream_error",
      `Ollama returned ${response.status} when listing models.`,
      502,
    );
  }

  const data = (await response.json()) as OllamaTagsResponse;

  return (data.models ?? [])
    .map((entry) => entry.name ?? entry.model ?? "")
    .filter((name): name is string => name.length > 0);
}
