"use client";

import { useState } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { Sidebar } from "@/components/layout/Sidebar";
import { MenuIcon } from "@/components/ui/Icons";
import { ModelStatusBadge } from "@/components/ui/ModelStatusBadge";
import { RoadmapView } from "@/components/views/RoadmapView";
import { SettingsView } from "@/components/views/SettingsView";
import { useWorkspace } from "@/context/WorkspaceProvider";
import { APP_NAME } from "@/lib/constants";

const HEADER_SUBTITLES: Record<string, string> = {
  chat: "Your private AI workspace",
  projects: "Project workspaces",
  knowledge: "Personal knowledge base",
  settings: "Preferences and local data",
};

export function Workspace() {
  const { view, activeConversation, isHydrated, isGenerating } = useWorkspace();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Conversations live in localStorage, so the real UI can only be rendered
  // once we are on the client. This placeholder is what the server renders.
  if (!isHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-canvas">
        <span className="size-2 rounded-full bg-accent thinking-dot" />
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
              className="rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-ink md:hidden"
            >
              <MenuIcon className="size-5" />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-[14px] font-medium">
                {view === "chat" && activeConversation
                  ? activeConversation.title
                  : APP_NAME}
              </h1>
              <p className="truncate text-[11.5px] text-faint">
                {HEADER_SUBTITLES[view]}
              </p>
            </div>
          </div>

          <ModelStatusBadge isGenerating={isGenerating} />
        </header>

        {view === "settings" ? (
          <SettingsView />
        ) : view === "projects" || view === "knowledge" ? (
          <RoadmapView view={view} />
        ) : (
          <ChatView />
        )}
      </main>
    </div>
  );
}
