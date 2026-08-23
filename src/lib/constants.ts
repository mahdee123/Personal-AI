/**
 * Client-safe constants. Anything here is inlined into the browser bundle,
 * so it must never contain endpoints or secrets — see lib/config.ts for those.
 */

export const APP_NAME = "Mahdee AI";
export const USER_NAME = "Mahdee";

/** Display + request value for the local model. Must match an installed Ollama tag. */
export const DEFAULT_MODEL_NAME = "qwen3:8b";
export const MODEL_LABEL = "Qwen3:8b";

export interface SuggestedPrompt {
  title: string;
  description: string;
  prompt: string;
}

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: "Research a new UX/UI project",
    description: "Plan the discovery phase end to end",
    prompt:
      "Help me research a new UX/UI project. Walk me through the discovery phase: what to learn first, which research methods fit, what questions to ask users, and how to turn the findings into design decisions.",
  },
  {
    title: "Create a product sitemap",
    description: "Structure the information architecture",
    prompt:
      "Help me create a product sitemap. Ask me what the product does if you need to, then propose a full information architecture with top-level navigation, sub-pages, and the rationale behind the grouping.",
  },
  {
    title: "Analyze my project requirements",
    description: "Turn a rough brief into a clear scope",
    prompt:
      "I want you to analyze my project requirements. I'll paste a rough brief and you should break it down into clear functional requirements, non-functional requirements, open questions, assumptions, and risks.",
  },
  {
    title: "Suggest a better user flow",
    description: "Simplify steps and cover edge cases",
    prompt:
      "Help me improve a user flow. I'll describe the current flow — review it step by step, point out friction and unnecessary steps, cover the empty/error/loading states I'm missing, and propose a cleaner alternative.",
  },
];
