/**
 * Browser-local persistence for conversations and settings.
 *
 * v1 stores everything in localStorage. The read/write surface is deliberately
 * narrow (four functions) so it can later be swapped for IndexedDB or a real
 * database without touching any component.
 */

import { DEFAULT_MODEL_NAME } from "@/lib/constants";
import type { AppSettings, ChatMessage, Conversation } from "@/lib/types";

const CONVERSATIONS_KEY = "mahdee-ai:conversations:v1";
const SETTINGS_KEY = "mahdee-ai:settings:v1";

export const DEFAULT_SETTINGS: AppSettings = {
  model: DEFAULT_MODEL_NAME,
  temperature: 0.7,
  customInstructions: "",
  showReasoning: false,
  deepThinking: false,
  numPredict: 2048,
  contextMessages: 10,
  imageGenerationEnabled: false,
  imageGenerationUrl: "http://localhost:8000",
  numThread: 4,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const conversation = value as Partial<Conversation>;
  return (
    typeof conversation.id === "string" &&
    typeof conversation.title === "string" &&
    Array.isArray(conversation.messages) &&
    conversation.messages.every(isMessage)
  );
}

export function loadConversations(): Conversation[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isConversation).map((conversation) => ({
      ...conversation,
      createdAt: conversation.createdAt ?? Date.now(),
      updatedAt: conversation.updatedAt ?? Date.now(),
      projectId: conversation.projectId ?? null,
    }));
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    // Quota exceeded or storage disabled — the app stays usable in memory.
  }
}

export function loadSettings(): AppSettings {
  if (!isBrowser()) return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    return {
      model:
        typeof parsed.model === "string" && parsed.model.length > 0
          ? parsed.model
          : DEFAULT_SETTINGS.model,
      temperature:
        typeof parsed.temperature === "number"
          ? Math.min(Math.max(parsed.temperature, 0), 1.5)
          : DEFAULT_SETTINGS.temperature,
      customInstructions:
        typeof parsed.customInstructions === "string"
          ? parsed.customInstructions
          : "",
      showReasoning: parsed.showReasoning === true,
      deepThinking: parsed.deepThinking === true,
      numPredict:
        typeof parsed.numPredict === "number" && parsed.numPredict >= 0
          ? parsed.numPredict
          : DEFAULT_SETTINGS.numPredict,
      contextMessages:
        typeof parsed.contextMessages === "number" &&
        parsed.contextMessages >= 1 &&
        parsed.contextMessages <= 30
          ? Math.round(parsed.contextMessages)
          : DEFAULT_SETTINGS.contextMessages,
      imageGenerationEnabled: parsed.imageGenerationEnabled === true,
      imageGenerationUrl:
        typeof parsed.imageGenerationUrl === "string" &&
        parsed.imageGenerationUrl.length > 0
          ? parsed.imageGenerationUrl
          : DEFAULT_SETTINGS.imageGenerationUrl,
      numThread:
        typeof parsed.numThread === "number" &&
        parsed.numThread >= 1 &&
        parsed.numThread <= 32
          ? Math.round(parsed.numThread)
          : DEFAULT_SETTINGS.numThread,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore — settings fall back to defaults on next load.
  }
}
