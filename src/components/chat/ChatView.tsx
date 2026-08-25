"use client";

import { useRef, useState } from "react";

import { Composer, type ComposerMode } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { WelcomeScreen } from "@/components/chat/WelcomeScreen";
import { useWorkspace } from "@/context/WorkspaceProvider";
import { isImageGenerationIntent } from "@/lib/utils";

interface FileAttachment {
  name: string;
  text: string;
}

export function ChatView() {
  const {
    messages,
    isGenerating,
    sendMessage,
    stopGenerating,
    generateImage,
    settings,
  } = useWorkspace();
  const [input, setInput] = useState("");
  const [fileAttachment, setFileAttachment] = useState<FileAttachment | null>(
    null,
  );
  const [images, setImages] = useState<string[]>([]);
  const [mode, setMode] = useState<ComposerMode>("chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const text = input;
    const attachment = fileAttachment;
    const attachedImages = images;
    setInput("");
    setFileAttachment(null);
    setImages([]);

    // Auto-detect image generation intent in chat mode.
    if (
      settings.imageGenerationEnabled &&
      mode === "chat" &&
      isImageGenerationIntent(text)
    ) {
      void generateImage(text);
      return;
    }

    void sendMessage(
      text,
      attachment ?? undefined,
      attachedImages.length > 0 ? attachedImages : undefined,
    );
  }

  function handleGenerateImage() {
    const prompt = input;
    if (prompt.trim().length === 0) return;
    setInput("");
    setFileAttachment(null);
    setImages([]);
    void generateImage(prompt);
  }

  /** Prefill the composer so the prompt can be edited before sending. */
  function handleSelectPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  return (
    <>
      {messages.length === 0 ? (
        <WelcomeScreen onSelectPrompt={handleSelectPrompt} />
      ) : (
        <MessageList messages={messages} isGenerating={isGenerating} />
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        onStop={stopGenerating}
        isGenerating={isGenerating}
        textareaRef={textareaRef}
        fileAttachment={fileAttachment}
        onFileAttachmentChange={setFileAttachment}
        images={images}
        onImagesChange={setImages}
        imageGenerationEnabled={settings.imageGenerationEnabled}
        onGenerateImage={handleGenerateImage}
        mode={mode}
        onModeChange={setMode}
      />
    </>
  );
}
