import { NextResponse } from "next/server";

import {
  DEFAULT_CONTEXT_MESSAGES,
  DEFAULT_NUM_PREDICT,
  MAX_MESSAGE_LENGTH,
  resolveModel,
} from "@/lib/config";
import {
  OllamaError,
  streamChatCompletion,
  type OllamaMessage,
  type StreamEvent,
} from "@/lib/ollama";
import { buildSystemPrompt } from "@/lib/system-prompt";
import type { ChatErrorResponse, ChatRequestBody, WireMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  body: ChatErrorResponse,
  status: number,
): NextResponse<ChatErrorResponse> {
  return NextResponse.json(body, { status });
}

/** Validates and trims the incoming conversation history. */
function parseMessages(
  input: unknown,
  contextMessages: number,
): WireMessage[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const messages: WireMessage[] = [];

  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return null;

    const { role, content, images } = entry as Partial<WireMessage>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;

    const trimmed = content.trim();
    if (trimmed.length === 0) continue;

    const msg: WireMessage = {
      role,
      content: trimmed.slice(0, MAX_MESSAGE_LENGTH),
    };
    if (Array.isArray(images) && images.length > 0) {
      msg.images = images;
    }
    messages.push(msg);
  }

  if (messages.length === 0) return null;

  // Only the tail of a long conversation is sent, to keep the prompt cheap.
  return messages.slice(-contextMessages);
}

function parseTemperature(input: unknown): number {
  if (typeof input !== "number" || Number.isNaN(input)) return 0.7;
  return Math.min(Math.max(input, 0), 2);
}

/**
 * Streams the reply back as newline-delimited JSON events:
 *   {"type":"delta","text":"…"}      visible answer tokens
 *   {"type":"reasoning","text":"…"}  chain-of-thought (deep thinking only)
 *   {"type":"done","durationMs":n}
 *   {"type":"error","error":"…","code":"…"}
 *
 * Failures that happen before the first byte are returned as a normal JSON
 * error response with a real status code instead.
 */
export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return errorResponse(
      { error: "Request body must be valid JSON.", code: "bad_request" },
      400,
    );
  }

  const messages = parseMessages(
    body.messages,
    typeof body.contextMessages === "number" &&
      body.contextMessages >= 1 &&
      body.contextMessages <= 30
      ? Math.round(body.contextMessages)
      : DEFAULT_CONTEXT_MESSAGES,
  );

  if (!messages) {
    return errorResponse(
      {
        error:
          "`messages` must be a non-empty array of { role: 'user' | 'assistant', content: string }.",
        code: "bad_request",
      },
      400,
    );
  }

  const payload: OllamaMessage[] = [
    { role: "system", content: buildSystemPrompt(body.customInstructions) },
    ...messages,
  ];

  // Append file attachment text to the last user message.
  if (body.fileAttachment && payload.length > 1) {
    const lastUserIdx = payload.findLastIndex((m) => m.role === "user");
    if (lastUserIdx !== -1) {
      const attachText = `\n\n---\nDocument: ${body.fileAttachment.name}\n---\n${body.fileAttachment.text}`;
      payload[lastUserIdx] = {
        ...payload[lastUserIdx],
        content: payload[lastUserIdx].content + attachText,
      };
    }
  }

  // Guard: images require a vision-capable model.
  const hasImages = payload.some((m) => m.images && m.images.length > 0);
  const modelName = resolveModel(body.model).toLowerCase();
  const isVisionModel =
    modelName.includes("vl") ||
    modelName.includes("vision") ||
    modelName.includes("llava") ||
    modelName.includes("moondream");

  if (hasImages && !isVisionModel) {
    return errorResponse(
      {
        error:
          `Your current model (${resolveModel(body.model)}) does not support images. ` +
          `To analyze images, install a vision model like qwen3-vl:8b and select it in Settings.`,
        code: "bad_request",
      },
      400,
    );
  }

  const completion = streamChatCompletion({
    model: resolveModel(body.model),
    messages: payload,
    temperature: parseTemperature(body.temperature),
    think: body.deepThinking === true,
    numPredict:
      typeof body.numPredict === "number" && body.numPredict >= 0
        ? body.numPredict
        : DEFAULT_NUM_PREDICT,
    signal: request.signal,
  });

  // Pull the first event before responding so connection errors surface as a
  // proper HTTP status rather than an empty 200 stream.
  let first: IteratorResult<StreamEvent>;

  try {
    first = await completion.next();
  } catch (error) {
    if (error instanceof OllamaError) {
      return errorResponse({ error: error.message, code: error.code }, error.status);
    }

    console.error("[api/chat] Unexpected failure:", error);

    return errorResponse(
      {
        error: "Something went wrong while generating a response.",
        code: "upstream_error",
      },
      500,
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        if (!first.done) send(first.value);

        for await (const event of completion) {
          send(event);
        }
      } catch (error) {
        if (error instanceof OllamaError) {
          send({ type: "error", error: error.message, code: error.code });
        } else if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("[api/chat] Stream failure:", error);
          send({
            type: "error",
            error: "The response was interrupted before it finished.",
            code: "upstream_error",
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
