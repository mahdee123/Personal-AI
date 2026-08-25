/** Small client/server-agnostic helpers. */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Derives a short conversation title from the first user message. */
export function deriveTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return "New chat";
  if (cleaned.length <= 42) return cleaned;
  return `${cleaned.slice(0, 42).trimEnd()}…`;
}

// "draw/paint/sketch/illustrate" are essentially never used for anything but
// producing a visual artifact — "draw a cat" needs no other signal.
const STRONG_VISUAL_VERBS = /\b(draw|paint|sketch|illustrate|doodle)\b/i;
// "generate/create/make/design/render/produce" are common general-purpose
// verbs ("create a document", "make a table") — only count these toward
// image intent when paired with an explicit image-related noun.
const GENERAL_VERBS = /\b(generate|create|make|design|render|produce)\b/i;
const IMAGE_NOUNS =
  /\b(image|picture|photo|illustration|artwork|drawing|icon|logo|graphic|painting|wallpaper|pic)s?\b/i;

/**
 * Detects an image-generation request in free-form text — not just a verb at
 * the very start, so natural phrasing like "now generate a black pen image"
 * or "please draw a cat" is caught, while a general-purpose verb alone
 * ("Create a user persona doc") is not mistaken for one.
 */
export function isImageGenerationIntent(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (STRONG_VISUAL_VERBS.test(trimmed)) return true;
  return GENERAL_VERBS.test(trimmed) && IMAGE_NOUNS.test(trimmed);
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
