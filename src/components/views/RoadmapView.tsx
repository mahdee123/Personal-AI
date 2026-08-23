"use client";

import { BookIcon, FolderIcon } from "@/components/ui/Icons";
import { useWorkspace } from "@/context/WorkspaceProvider";

/**
 * Projects and Knowledge Base are planned for v2. Rather than shipping fake
 * buttons, these screens state plainly what is not built yet and what the
 * groundwork already in place is.
 */

interface RoadmapContent {
  icon: typeof FolderIcon;
  title: string;
  intro: string;
  planned: Array<{ name: string; detail: string }>;
  groundwork: string;
}

const CONTENT: Record<"projects" | "knowledge", RoadmapContent> = {
  projects: {
    icon: FolderIcon,
    title: "Projects",
    intro:
      "Project workspaces will let you group conversations, files, and notes per client or product, each with its own context.",
    planned: [
      {
        name: "Project workspaces",
        detail: "Group chats under a project and share context between them.",
      },
      {
        name: "Per-project instructions",
        detail: "Standing context the assistant applies inside that project only.",
      },
      {
        name: "Document generation",
        detail: "Export specs and research notes to DOCX and PDF.",
      },
    ],
    groundwork:
      "Every conversation already stores a projectId field, so existing chats can be assigned to projects without losing history.",
  },
  knowledge: {
    icon: BookIcon,
    title: "Knowledge Base",
    intro:
      "The knowledge base will let Mahdee AI answer from your own documents instead of general training data alone.",
    planned: [
      {
        name: "PDF upload and analysis",
        detail: "Drop in a brief or research report and ask questions about it.",
      },
      {
        name: "Google Docs integration",
        detail: "Pull specs and notes straight from your Drive.",
      },
      {
        name: "RAG with a vector database",
        detail: "Retrieve relevant passages and add them to the prompt context.",
      },
      {
        name: "Long-term memory",
        detail: "Remember your preferences and projects across conversations.",
      },
    ],
    groundwork:
      "The system prompt is assembled server-side in one place, so retrieved passages can be injected without changing any component.",
  },
};

export function RoadmapView({ view }: { view: "projects" | "knowledge" }) {
  const { startNewChat } = useWorkspace();
  const content = CONTENT[view];
  const Icon = content.icon;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <span className="mb-5 flex size-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-accent-soft">
          <Icon className="size-5" />
        </span>

        <h2 className="text-2xl font-semibold tracking-tight">{content.title}</h2>

        <span className="mt-3 inline-block rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-faint">
          Not available in v1
        </span>

        <p className="mt-4 text-[14px] leading-6 text-muted">{content.intro}</p>

        <h3 className="mt-8 text-[13px] font-medium uppercase tracking-wider text-faint">
          Planned
        </h3>

        <ul className="mt-3 space-y-2">
          {content.planned.map((item) => (
            <li
              key={item.name}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <p className="text-[14px] font-medium text-ink">{item.name}</p>
              <p className="mt-1 text-[13px] leading-5 text-faint">{item.detail}</p>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-xl border border-line-soft bg-surface-2/50 p-4 text-[13px] leading-6 text-faint">
          {content.groundwork}
        </p>

        <button
          type="button"
          onClick={startNewChat}
          className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-[14px] text-ink transition hover:border-accent/40"
        >
          Back to chat
        </button>
      </div>
    </div>
  );
}
