"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_MODEL_NAME } from "@/lib/constants";
import type { HealthResponse } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

const OFFLINE_MESSAGE =
  "Unable to connect to the local AI model. Please make sure Ollama is running.";

const INITIAL: HealthResponse = {
  online: false,
  modelAvailable: false,
  model: DEFAULT_MODEL_NAME,
  models: [],
  message: "Checking the local model…",
};

/**
 * Subscribes the UI to the local Ollama connection by polling /api/health.
 *
 * `model` tells the poll which model to actually keep warm — pass the
 * currently selected model, not a hardcoded default. Otherwise every poll
 * silently reloads a different model than the one in use, and the two sit
 * resident in memory at the same time for no reason (this doubled the
 * resident model footprint and starved a vision request during testing).
 *
 * `isGenerating`: when true the health poll skips preloadModel to avoid CPU
 * contention during active generation.
 */
export function useModelStatus(model?: string, isGenerating = false) {
  const [status, setStatus] = useState<HealthResponse>(INITIAL);
  const [isChecking, setIsChecking] = useState(true);
  const isGeneratingRef = useRef(isGenerating);
  const modelRef = useRef(model);

  // Keep the refs in sync so the interval callback reads the latest values.
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
    modelRef.current = model;
  });

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (isGeneratingRef.current) params.set("active", "1");
      if (modelRef.current) params.set("model", modelRef.current);
      const query = params.toString();

      const response = await fetch(`/api/health${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as HealthResponse;
      setStatus(data);
    } catch {
      setStatus({ ...INITIAL, message: OFFLINE_MESSAGE });
    } finally {
      setIsChecking(false);
    }
  }, []);

  /** Manual re-check from a button — shows the checking state immediately. */
  const recheck = useCallback(() => {
    setIsChecking(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const poll = () => {
      if (cancelled) return;
      void refresh();
    };

    // Fire immediately on mount for early model warm-up.
    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { status, isChecking, refresh: recheck };
}
