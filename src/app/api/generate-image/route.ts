import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIDECAR_URL =
  process.env.IMAGE_GENERATION_URL || "http://localhost:8000";

interface GenerateImageBody {
  prompt?: string;
  width?: number;
  height?: number;
}

export async function POST(request: Request) {
  let body: GenerateImageBody;

  try {
    body = (await request.json()) as GenerateImageBody;
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

  try {
    // CPU mode can take several minutes per image.
    const response = await fetch(`${SIDECAR_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        width: body.width ?? 1024,
        height: body.height ?? 1024,
      }),
      signal: AbortSignal.timeout(600_000), // 10 minutes for CPU mode
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
        "Cannot connect to the image generation service. " +
        "Make sure you have Python installed and run: python-server\\start.bat";
    }

    return NextResponse.json(
      { error: message, code: "upstream_error" },
      { status: 503 },
    );
  }
}

export async function GET() {
  try {
    const response = await fetch(`${SIDECAR_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        status: "offline",
        message:
          "Image generation service is not running. Run: python-server\\start.bat",
      },
      { status: 200 },
    );
  }
}
