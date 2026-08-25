"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";

import { CloseIcon, ImageIcon, PaperclipIcon, SendIcon, SparkIcon, StopIcon } from "@/components/ui/Icons";
import { MODEL_LABEL } from "@/lib/constants";
import { cn, isImageGenerationIntent } from "@/lib/utils";

const MAX_HEIGHT_PX = 200;
const MAX_IMAGES = 4;
const MAX_IMAGE_DIMENSION = 768;
const ACCEPTED_FILE_TYPES = ".pdf,.txt,.md,.csv,.json";
const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/**
 * Resizes an image file to fit within MAX_IMAGE_DIMENSION and converts to
 * JPEG for smaller base64 output. Returns the base64-encoded string.
 */
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG for smaller size.
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve(base64 ?? "");
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

interface FileAttachment {
  name: string;
  text: string;
}

export type ComposerMode = "chat" | "image";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isGenerating: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileAttachment: FileAttachment | null;
  onFileAttachmentChange: (attachment: FileAttachment | null) => void;
  images: string[];
  onImagesChange: (images: string[] | ((prev: string[]) => string[])) => void;
  imageGenerationEnabled: boolean;
  onGenerateImage: () => void;
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  isGenerating,
  textareaRef,
  fileAttachment,
  onFileAttachmentChange,
  images,
  onImagesChange,
  imageGenerationEnabled,
  onGenerateImage,
  mode,
  onModeChange,
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Grow the textarea with its content, up to a fixed ceiling.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value, textareaRef]);

  function handleSend() {
    if (mode === "image") {
      if (value.trim().length === 0) return;
      onGenerateImage();
    } else {
      if (value.trim().length === 0 && !fileAttachment && images.length === 0) return;
      onSubmit();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isGenerating) return;
    handleSend();
  }

  /** Enter sends, Shift+Enter inserts a newline. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    // Don't hijack Enter while an IME candidate window is open.
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();
    if (isGenerating) return;
    handleSend();
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to upload file.");
        return;
      }

      onFileAttachmentChange({ name: data.fileName, text: data.text });
    } catch {
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;

    const remaining = MAX_IMAGES - images.length;
    const filesToProcess = Array.from(files).slice(0, remaining);

    for (const file of filesToProcess) {
      resizeImage(file)
        .then((base64) => {
          if (base64) {
            onImagesChange((prev) => [...prev, base64]);
          }
        })
        .catch(() => {
          // Silently skip failed images.
        });
    }

    event.target.value = "";
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/") && images.length < MAX_IMAGES) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        resizeImage(file)
          .then((base64) => {
            if (base64) {
              onImagesChange((prev) => [...prev, base64]);
            }
          })
          .catch(() => {});
        break;
      }
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/") && images.length < MAX_IMAGES) {
        resizeImage(file)
          .then((base64) => {
            if (base64) {
              onImagesChange((prev) => [...prev, base64]);
            }
          })
          .catch(() => {});
      }
    }
  }

  const canSend =
    !isGenerating &&
    (value.trim().length > 0 || (mode === "chat" && (fileAttachment !== null || images.length > 0)));

  // Auto-detect image generation intent when in chat mode with image gen enabled.
  const autoImageMode =
    imageGenerationEnabled && mode === "chat" && isImageGenerationIntent(value);

  return (
    <div className="border-t border-line bg-canvas/80 px-4 pb-4 pt-3 backdrop-blur sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl">
        {/* Mode toggle */}
        {imageGenerationEnabled && (
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              onClick={() => onModeChange("chat")}
              className={cn(
                "rounded-lg px-3 py-1 text-[12px] font-medium transition",
                mode === "chat" && !autoImageMode
                  ? "bg-accent/15 text-accent-soft"
                  : "text-faint hover:text-muted",
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => onModeChange("image")}
              className={cn(
                "rounded-lg px-3 py-1 text-[12px] font-medium transition",
                (mode === "image" || autoImageMode)
                  ? "bg-amber-400/15 text-amber-300"
                  : "text-faint hover:text-muted",
              )}
            >
              Image
            </button>
          </div>
        )}

        {/* File attachment chip */}
        {fileAttachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-line-soft bg-surface-2 px-3 py-2 text-[13px]">
            <span className="truncate text-muted">
              {fileAttachment.name}
            </span>
            <button
              type="button"
              onClick={() => onFileAttachmentChange(null)}
              className="ml-auto shrink-0 rounded p-0.5 text-faint transition hover:text-muted"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* Image previews */}
        {images.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {images.map((base64, index) => (
              <div key={index} className="relative size-16 overflow-hidden rounded-lg border border-line-soft">
                <img
                  src={`data:image/png;base64,${base64}`}
                  alt={`Upload ${index + 1}`}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onImagesChange(images.filter((_, i) => i !== index))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white transition hover:bg-black/80"
                >
                  <CloseIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-surface p-2 transition",
            isGenerating ? "border-line opacity-90" : "border-line focus-within:border-accent/50",
          )}
        >
          {/* File upload button — chat mode only */}
          {mode === "chat" && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating || isUploading}
              title="Attach a file (PDF, TXT, MD, CSV)"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PaperclipIcon className="size-4" />
            </button>
          )}

          {/* Image upload button — chat mode only */}
          {mode === "chat" && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isGenerating || images.length >= MAX_IMAGES}
              title="Upload an image"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ImageIcon className="size-4" />
            </button>
          )}

          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={isGenerating}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={mode === "chat" ? handlePaste : undefined}
            onDrop={mode === "chat" ? handleDrop : undefined}
            onDragOver={(e) => e.preventDefault()}
            placeholder={
              isGenerating
                ? "Mahdee AI is responding…"
                : autoImageMode
                  ? "Image generation mode — press Enter to generate"
                  : mode === "image"
                    ? "Describe the image you want to generate…"
                    : "Message Mahdee AI…  (Enter to send, Shift + Enter for a new line)"
            }
            className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed disabled:opacity-60"
          />

          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              title="Stop generating"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted transition hover:text-ink"
            >
              <StopIcon className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              title={autoImageMode || mode === "image" ? "Generate image" : "Send message"}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:text-faint",
                autoImageMode || mode === "image"
                  ? "bg-amber-400 text-black hover:bg-amber-300 disabled:bg-surface-3"
                  : "bg-accent text-white hover:bg-accent-soft disabled:bg-surface-3",
              )}
            >
              {autoImageMode || mode === "image" ? (
                <SparkIcon className="size-4" />
              ) : (
                <SendIcon className="size-4" />
              )}
            </button>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-faint">
          Running privately on your machine · {MODEL_LABEL} via Ollama
        </p>
      </form>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={imageInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  );
}
