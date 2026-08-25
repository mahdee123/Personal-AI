import { NextRequest, NextResponse } from "next/server";

import { resolveModel } from "@/lib/config";
import {
  listModels,
  OLLAMA_OFFLINE_MESSAGE,
  OllamaError,
  preloadModel,
} from "@/lib/ollama";
import type { HealthResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Powers the "Local AI online/offline" indicator and keeps a model warm.
 *
 * Preloads whichever model the caller is actually using (?model=), not always
 * the hardcoded default — otherwise this poll would keep silently reloading
 * qwen3:8b in the background every 30s even while the user has switched to
 * qwen3-vl:8b, doubling the resident model memory for no reason.
 */
export async function GET(request: NextRequest) {
  // When the client is actively generating, skip preload to avoid CPU contention.
  const isActive = request.nextUrl.searchParams.get("active") === "1";
  const targetModel = resolveModel(
    request.nextUrl.searchParams.get("model") ?? undefined,
  );

  try {
    const models = await listModels();
    const modelAvailable = models.includes(targetModel);

    if (modelAvailable && !isActive) {
      // Not awaited: loading the model takes tens of seconds the first time,
      // and the status badge should not wait for it. Each poll also refreshes
      // the keep-alive timer, so the model stays warm while the app is open.
      void preloadModel(targetModel).catch(() => {});
    }

    return NextResponse.json<HealthResponse>({
      online: true,
      modelAvailable,
      model: targetModel,
      models,
      message: modelAvailable
        ? `${targetModel} is ready.`
        : `Ollama is running, but ${targetModel} is not installed. Run: ollama pull ${targetModel}`,
    });
  } catch (error) {
    const message =
      error instanceof OllamaError ? error.message : OLLAMA_OFFLINE_MESSAGE;

    return NextResponse.json<HealthResponse>(
      {
        online: false,
        modelAvailable: false,
        model: targetModel,
        models: [],
        message,
      },
      { status: 200 },
    );
  }
}
