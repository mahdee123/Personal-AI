"use client";

/**
 * Single source of truth for the workspace: conversations, settings, the
 * active view, and the request lifecycle for talking to /api/chat.
 *
 * Components stay presentational and read from this context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useIsHydrated } from "@/hooks/useIsHydrated";
import {
  loadConversations,
  loadSettings,
  saveConversations,
  saveSettings,
} from "@/lib/storage";
import type {
  AppSettings,
  ChatErrorResponse,
  ChatMessage,
  ChatStreamEvent,
  Conversation,
} from "@/lib/types";
import { createId, deriveTitle } from "@/lib/utils";

export type WorkspaceView = "chat" | "projects" | "knowledge" | "settings";

const OFFLINE_MESSAGE =
  "Unable to connect to the local AI model. Please make sure Ollama is running.";

/** Parses the newline-delimited JSON event stream from /api/chat. */
async function* readStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      pending += decoder.decode(value, { stream: true });

      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim().length === 0) continue;

        try {
          yield JSON.parse(line) as ChatStreamEvent;
        } catch {
          // Ignore a malformed line rather than dropping the whole reply.
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

interface WorkspaceContextValue {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  settings: AppSettings;
  view: WorkspaceView;
  isGenerating: boolean;
  isHydrated: boolean;
  setView: (view: WorkspaceView) => void;
  startNewChat: () => void;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearAllConversations: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  sendMessage: (
    text: string,
    fileAttachment?: { name: string; text: string },
    images?: string[],
  ) => Promise<void>;
  stopGenerating: () => void;
  generateImage: (prompt: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: createId(),
    title: "New chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    projectId: null,
  };
}

function createMessage(
  role: ChatMessage["role"],
  content: string,
  extra?: Partial<ChatMessage>,
): ChatMessage {
  return {
    id: createId(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  // Persisted state is read once, lazily. On the server these return empty
  // defaults; the UI is gated on isHydrated so both renders agree.
  const [conversations, setConversations] = useState<Conversation[]>(
    loadConversations,
  );
  // The app always opens on the welcome screen; history stays in the sidebar.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [view, setView] = useState<WorkspaceView>("chat");
  const [isGenerating, setIsGenerating] = useState(false);
  const isHydrated = useIsHydrated();

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Cancel any in-flight generation when the app unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  );

  const patchConversation = useCallback(
    (id: string, patch: (conversation: Conversation) => Conversation) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === id ? patch(conversation) : conversation,
        ),
      );
    },
    [],
  );

  const startNewChat = useCallback(() => {
    setActiveId(null);
    setView("chat");
  }, []);

  const openConversation = useCallback((id: string) => {
    setActiveId(id);
    setView("chat");
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((previous) => {
      const next = previous.filter((conversation) => conversation.id !== id);
      setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current));
      return next;
    });
  }, []);

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim();
      if (trimmed.length === 0) return;
      patchConversation(id, (conversation) => ({ ...conversation, title: trimmed }));
    },
    [patchConversation],
  );

  const clearAllConversations = useCallback(() => {
    setConversations([]);
    setActiveId(null);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      fileAttachment?: { name: string; text: string },
      images?: string[],
    ) => {
      const content = text.trim();
      if (
        content.length === 0 &&
        !fileAttachment &&
        (!images || images.length === 0)
      )
        return;
      if (isGenerating) return;

      const existing = conversations.find(
        (conversation) => conversation.id === activeId,
      );
      const isNew = !existing;
      const base = existing ?? createConversation();
      const userMessage = createMessage(
        "user",
        content || (fileAttachment ? `Attached: ${fileAttachment.name}` : "Image"),
        {
          images: images && images.length > 0 ? images : undefined,
          fileAttachment: fileAttachment ?? undefined,
        },
      );

      const updated: Conversation = {
        ...base,
        title:
          base.messages.length === 0 ? deriveTitle(content || fileAttachment?.name || "Image") : base.title,
        messages: [...base.messages, userMessage],
        updatedAt: Date.now(),
      };

      setConversations((previous) =>
        isNew
          ? [updated, ...previous]
          : previous.map((conversation) =>
              conversation.id === updated.id ? updated : conversation,
            ),
      );
      setActiveId(updated.id);
      setView("chat");
      setIsGenerating(true);

      // Error notices are UI-only and are never sent back to the model.
      const history = updated.messages
        .filter((message) => !message.isError)
        .map((message) => ({
          role: message.role,
          content: message.content,
          images: message.images,
        }));

      const controller = new AbortController();
      abortRef.current = controller;

      // The assistant turn is appended empty and filled in as tokens arrive.
      const assistantId = createId();

      patchConversation(updated.id, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
        ],
      }));

      const replaceAssistant = (patch: Partial<ChatMessage>) => {
        patchConversation(updated.id, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message,
          ),
          updatedAt: Date.now(),
        }));
      };

      let answer = "";
      let reasoning = "";
      let failed = false;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history,
            model: settings.model,
            temperature: settings.temperature,
            customInstructions: settings.customInstructions,
            deepThinking: settings.deepThinking,
            numPredict: settings.numPredict,
            contextMessages: settings.contextMessages,
            fileAttachment: fileAttachment ?? undefined,
            numThread: settings.numThread,
          }),
        });

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as
            | ChatErrorResponse
            | null;

          failed = true;
          replaceAssistant({
            content: data?.error ?? OFFLINE_MESSAGE,
            isError: true,
          });
        } else {
          for await (const event of readStream(response.body, controller.signal)) {
            if (event.type === "delta") {
              answer += event.text;
              replaceAssistant({ content: answer });
            } else if (event.type === "reasoning") {
              reasoning += event.text;
              replaceAssistant({ reasoning });
            } else if (event.type === "error") {
              failed = true;
              // Nothing streamed yet — show the error in place of the reply.
              if (answer.length === 0) {
                replaceAssistant({ content: event.error, isError: true });
              } else {
                replaceAssistant({ content: `${answer}\n\n_${event.error}_` });
              }
            }
          }

          // A reply that is only reasoning would render as nothing at all.
          if (!failed && answer.length === 0) {
            replaceAssistant({
              content:
                "_The model finished without producing an answer. Try rephrasing your question._",
            });
          }
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";

        if (aborted) {
          // Keep whatever was streamed before the user pressed Stop.
          if (answer.length === 0) {
            patchConversation(updated.id, (conversation) => ({
              ...conversation,
              messages: conversation.messages.filter(
                (message) => message.id !== assistantId,
              ),
            }));
          }
        } else {
          replaceAssistant({ content: OFFLINE_MESSAGE, isError: true });
        }
      }

      abortRef.current = null;
      setIsGenerating(false);
    },
    [activeId, conversations, isGenerating, patchConversation, settings],
  );

  const generateImage = useCallback(
    async (prompt: string) => {
      if (isGenerating || !settings.imageGenerationEnabled) return;

      const content = prompt.trim();
      if (content.length === 0) return;

      const existing = conversations.find(
        (conversation) => conversation.id === activeId,
      );
      const isNew = !existing;
      const base = existing ?? createConversation();
      const userMessage = createMessage("user", content);

      const updated: Conversation = {
        ...base,
        title:
          base.messages.length === 0
            ? deriveTitle(content)
            : base.title,
        messages: [...base.messages, userMessage],
        updatedAt: Date.now(),
      };

      setConversations((previous) =>
        isNew
          ? [updated, ...previous]
          : previous.map((conversation) =>
              conversation.id === updated.id ? updated : conversation,
            ),
      );
      setActiveId(updated.id);
      setView("chat");
      setIsGenerating(true);

      const assistantId = createId();

      patchConversation(updated.id, (conversation) => ({
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            id: assistantId,
            role: "assistant",
            content: "",
            createdAt: Date.now(),
          },
        ],
      }));

      const replaceAssistant = (patch: Partial<ChatMessage>) => {
        patchConversation(updated.id, (conversation) => ({
          ...conversation,
          messages: conversation.messages.map((message) =>
            message.id === assistantId ? { ...message, ...patch } : message,
          ),
          updatedAt: Date.now(),
        }));
      };

      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: content,
            sidecarUrl: settings.imageGenerationUrl,
          }),
        });

        const data = (await response.json().catch(() => null)) as {
          image?: string;
          error?: string;
        } | null;

        if (!response.ok || !data?.image) {
          replaceAssistant({
            content: data?.error ?? "Image generation failed.",
            isError: true,
          });
        } else {
          replaceAssistant({
            content: `Generated image for: "${content}"`,
            generatedImage: data.image,
          });
        }
      } catch {
        replaceAssistant({
          content:
            "Cannot reach the image generation service. Make sure the Python sidecar is running.",
          isError: true,
        });
      }

      abortRef.current = null;
      setIsGenerating(false);
    },
    [activeId, conversations, isGenerating, patchConversation, settings, setView],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      conversations,
      activeConversation,
      messages: activeConversation?.messages ?? [],
      settings,
      view,
      isGenerating,
      isHydrated,
      setView,
      startNewChat,
      openConversation,
      deleteConversation,
      renameConversation,
      clearAllConversations,
      updateSettings,
      sendMessage,
      stopGenerating,
      generateImage,
    }),
    [
      activeConversation,
      clearAllConversations,
      conversations,
      deleteConversation,
      generateImage,
      isGenerating,
      isHydrated,
      openConversation,
      renameConversation,
      sendMessage,
      settings,
      startNewChat,
      stopGenerating,
      updateSettings,
      view,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider.");
  }

  return context;
}
