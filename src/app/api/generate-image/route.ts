import { NextResponse } from "next/server";

import type {
  ImageGenerationRequestBody,
  ImageServiceHealth,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SIDECAR_URL =
  process.env.IMAGE_GENERATION_URL || "http://localhost:8000";

/**
 * Resolves the sidecar URL to use for this request: the caller's Settings
 * value takes priority, falling back to the server env var / built-in
 * default when absent or invalid. Only http/https URLs are accepted.
 */
function resolveSidecarUrl(candidate: string | null | undefined): string {
  const trimmed = candidate?.trim();
  if (!trimmed) return DEFAULT_SIDECAR_URL;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_SIDECAR_URL;
    }
    return trimmed.replace(/\/+$/, "");
  } catch {
    return DEFAULT_SIDECAR_URL;
  }
}

export async function POST(request: Request) {
  let body: ImageGenerationRequestBody;

  try {
    body = (await request.json()) as ImageGenerationRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "bad_request" },
      { status: 400 },
    );
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "`prompt` is required.", code: "bad_request" },
      { status: 400 },
    );
  }

  const sidecarUrl = resolveSidecarUrl(body.sidecarUrl);

  try {
    // SDXL-Turbo is distilled for 512x512; CPU mode is tens of seconds/image.
    const response = await fetch(`${sidecarUrl}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: body.width ?? 512,
        height: body.height ?? 512,
      }),
      signal: AbortSignal.timeout(180_000), // 3 minutes is generous for CPU mode
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Image generation failed (${response.status}). ${detail.slice(0, 200)}`.trim(),
          code: "upstream_error",
        },
        { status: 502 },
      );
    }

    const data = (await response.json()) as { image?: string };

    if (!data.image) {
      return NextResponse.json(
        { error: "No image returned from the generation service.", code: "upstream_error" },
        { status: 502 },
      );
    }

    return NextResponse.json({ image: data.image });
  } catch (error) {
    let message: string;

    if (error instanceof DOMException && error.name === "TimeoutError") {
      message =
        "Image generation timed out. On CPU mode, try a shorter prompt or smaller resolution.";
    } else {
      message =
        `Cannot connect to the image generation service at ${sidecarUrl}. ` +
        "Make sure you have Python installed and run: python-server\\start.bat";
    }

    return NextResponse.json(
      { error: message, code: "upstream_error" },
      { status: 503 },
    );
  }
}

/** Health check proxy, used by the "Image service" status indicator in Settings. */
export async function GET(request: Request) {
  const requestedUrl = new URL(request.url).searchParams.get("url");
  const sidecarUrl = resolveSidecarUrl(requestedUrl);

  try {
    const response = await fetch(`${sidecarUrl}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const data = (await response.json()) as ImageServiceHealth;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json<ImageServiceHealth>(
      {
        status: "offline",
        message: `Image generation service is not reachable at ${sidecarUrl}. Run: python-server\\start.bat`,
      },
      { status: 200 },
    );
  }
}
