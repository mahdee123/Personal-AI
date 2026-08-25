/**
 * Server-side configuration for the local Ollama connection.
 *
 * The Ollama base URL is intentionally kept on the server only: the browser
 * never talks to Ollama directly, it always goes through /api/chat. That
 * avoids CORS entirely and keeps the model endpoint out of client bundles.
 */

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export const OLLAMA_BASE_URL = readEnv(
  "OLLAMA_BASE_URL",
  "http://localhost:11434",
).replace(/\/+$/, "");

export const DEFAULT_MODEL = readEnv("OLLAMA_MODEL", "qwen3:8b");

/**
 * Absolute backstop for a single chat request (connect + full generation).
 * This should rarely be the thing that fires — OLLAMA_IDLE_TIMEOUT_MS below
 * is the primary defense against a stuck request. This just bounds how long
 * a pathologically slow-but-still-responding request can run before giving
 * up. CPU-only vision analysis and deep-thinking replies can legitimately
 * take several minutes, so this is intentionally generous.
 */
export const OLLAMA_TIMEOUT_MS = Number.parseInt(
  readEnv("OLLAMA_TIMEOUT_MS", "600000"),
  10,
);

/**
 * How long a streaming chat request may go without receiving any data before
 * it's considered stuck and aborted. Resets on every chunk received, so a
 * reply that's merely slow (not hung) is never killed by this — only a
 * connection that's gone genuinely silent is.
 *
 * Vision requests emit nothing at all during image encoding / prompt eval —
 * no partial chunk arrives to reset this clock until the model starts
 * producing text. Measured on an i5-10400 (6 cores) with other apps running:
 * that silent phase alone took ~75-90s, with real variance depending on what
 * else is competing for CPU. 90s cut it too close and caused false timeouts;
 * this needs real headroom above the slow end of that range, not just past it.
 */
export const OLLAMA_IDLE_TIMEOUT_MS = Number.parseInt(
  readEnv("OLLAMA_IDLE_TIMEOUT_MS", "300000"),
  10,
);

/**
 * How long Ollama keeps the model in memory after a request. Loading an 8B
 * model takes tens of seconds, so keeping it resident avoids paying that on
 * every message after an idle pause.
 */
export const OLLAMA_KEEP_ALIVE = readEnv("OLLAMA_KEEP_ALIVE", "30m");

/** Model names are passed to a local server only; just reject odd characters. */
const MODEL_NAME_PATTERN = /^[\w.:/-]{1,80}$/;

export function resolveModel(requested?: string): string {
  return typeof requested === "string" && MODEL_NAME_PATTERN.test(requested)
    ? requested
    : DEFAULT_MODEL;
}

/**
 * Heuristic for "can this Ollama model accept image input" — Ollama has no
 * capability field for this, so it's a name match against known vision model
 * families (qwen*-vl, llava, moondream, bakllava, etc.).
 */
export function isVisionModelName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("vl") ||
    lower.includes("vision") ||
    lower.includes("llava") ||
    lower.includes("moondream")
  );
}

/**
 * Number of most recent messages forwarded as context. Every token of history
 * has to be re-read by the model before it can answer, so this stays small.
 * Default is 10 — can be overridden per-request via settings.
 */
export const DEFAULT_CONTEXT_MESSAGES = 10;

/** Hard cap on a single message, guards against accidental huge pastes. */
export const MAX_MESSAGE_LENGTH = 24_000;

/**
 * Default max tokens the model should generate per reply. Lower values produce
 * faster responses. 0 means unlimited.
 */
export const DEFAULT_NUM_PREDICT = 2048;
