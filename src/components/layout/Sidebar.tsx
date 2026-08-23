"use client";

import { useWorkspace, type WorkspaceView } from "@/context/WorkspaceProvider";
import { APP_NAME, MODEL_LABEL } from "@/lib/constants";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  BookIcon,
  ChatIcon,
  CloseIcon,
  FolderIcon,
  PlusIcon,
  SettingsIcon,
  SparkIcon,
  TrashIcon,
} from "@/components/ui/Icons";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS: Array<{
  view: WorkspaceView;
  label: string;
  icon: typeof ChatIcon;
}> = [
  { view: "chat", label: "Chats", icon: ChatIcon },
  { view: "projects", label: "Projects", icon: FolderIcon },
  { view: "knowledge", label: "Knowledge Base", icon: BookIcon },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    conversations,
    activeConversation,
    view,
    setView,
    startNewChat,
    openConversation,
    deleteConversation,
  } = useWorkspace();

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-line bg-surface transition-transform duration-200 md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 text-accent-soft">
              <SparkIcon className="size-4.5" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              {APP_NAME.split(" ")[0]}{" "}
              <span className="text-muted">{APP_NAME.split(" ")[1]}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => {
              startNewChat();
              onClose();
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-surface-3"
          >
            <PlusIcon className="size-4 text-accent-soft" />
            New Chat
          </button>
        </div>

        <nav className="space-y-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const ItemIcon = item.icon;
            const isActive = view === item.view;

            return (
              <button
                key={item.view}
                type="button"
                onClick={() => {
                  setView(item.view);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-surface-3 text-ink"
                    : "text-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <ItemIcon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-faint">
            Chat History
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {conversations.length === 0 ? (
              <p className="px-2 py-3 text-xs leading-5 text-faint">
                No conversations yet. Start a new chat and it will appear here.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {conversations.map((conversation) => {
                  const isActive =
                    view === "chat" && conversation.id === activeConversation?.id;

                  return (
                    <li key={conversation.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          openConversation(conversation.id);
                          onClose();
                        }}
                        className={cn(
                          "w-full rounded-lg py-2 pl-3 pr-9 text-left transition",
                          isActive
                            ? "bg-surface-3"
                            : "hover:bg-surface-2",
                        )}
                      >
                        <span
                          className={cn(
                            "block truncate text-[13px]",
                            isActive ? "text-ink" : "text-muted",
                          )}
                        >
                          {conversation.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-faint">
                          {formatRelativeTime(conversation.updatedAt)} ·{" "}
                          {conversation.messages.length} messages
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-label={`Delete ${conversation.title}`}
                        onClick={() => deleteConversation(conversation.id)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-faint opacity-0 transition hover:bg-offline/15 hover:text-offline focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={() => {
              setView("settings");
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
              view === "settings"
                ? "bg-surface-3 text-ink"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <SettingsIcon className="size-4" />
            Settings
          </button>

          <div className="mt-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-wider text-faint">
              Local Model
            </p>
            <p className="mt-1 flex items-center gap-2 text-[13px] font-medium text-ink">
              <span className="size-1.5 rounded-full bg-accent" />
              {MODEL_LABEL}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
