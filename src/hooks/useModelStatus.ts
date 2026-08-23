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
 * Accepts an optional isGenerating flag — when true the health poll skips
 * preloadModel to avoid CPU contention during active generation.
 */
export function useModelStatus(isGenerating = false) {
  const [status, setStatus] = useState<HealthResponse>(INITIAL);
  const [isChecking, setIsChecking] = useState(true);
  const isGeneratingRef = useRef(isGenerating);

  // Keep the ref in sync so the interval callback reads the latest value.
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  });

  const refresh = useCallback(async () => {
    try {
      const active = isGeneratingRef.current ? "?active=1" : "";
      const response = await fetch(`/api/health${active}`, { cache: "no-store" });
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
