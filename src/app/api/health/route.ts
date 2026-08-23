import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_MODEL } from "@/lib/config";
import {
  listModels,
  OLLAMA_OFFLINE_MESSAGE,
  OllamaError,
  preloadModel,
} from "@/lib/ollama";
import type { HealthResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Powers the "Local AI online/offline" indicator in the header. */
export async function GET(request: NextRequest) {
  // When the client is actively generating, skip preload to avoid CPU contention.
  const isActive = request.nextUrl.searchParams.get("active") === "1";

  try {
    const models = await listModels();
    const modelAvailable = models.includes(DEFAULT_MODEL);

    if (modelAvailable && !isActive) {
      // Not awaited: loading the model takes tens of seconds the first time,
      // and the status badge should not wait for it. Each poll also refreshes
      // the keep-alive timer, so the model stays warm while the app is open.
      void preloadModel(DEFAULT_MODEL).catch(() => {});
    }

    return NextResponse.json<HealthResponse>({
      online: true,
      modelAvailable,
      model: DEFAULT_MODEL,
      models,
      message: modelAvailable
        ? `${DEFAULT_MODEL} is ready.`
        : `Ollama is running, but ${DEFAULT_MODEL} is not installed. Run: ollama pull ${DEFAULT_MODEL}`,
    });
  } catch (error) {
    const message =
      error instanceof OllamaError ? error.message : OLLAMA_OFFLINE_MESSAGE;

    return NextResponse.json<HealthResponse>(
      {
        online: false,
        modelAvailable: false,
        model: DEFAULT_MODEL,
        models: [],
        message,
      },
      { status: 200 },
    );
  }
}
