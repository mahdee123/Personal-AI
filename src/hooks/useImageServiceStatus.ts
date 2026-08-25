"use client";

import { useCallback, useEffect, useState } from "react";

import type { ImageServiceHealth } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000;

const INITIAL: ImageServiceHealth = {
  status: "offline",
  message: "Checking the image generation service…",
};

/**
 * Polls GET /api/generate-image (a proxy to the Python sidecar's /health) so
 * Settings can show whether the image generation backend is reachable.
 * Only polls while `enabled` is true — there's no point pinging a sidecar
 * the user has switched off.
 */
export function useImageServiceStatus(sidecarUrl: string, enabled: boolean) {
  const [status, setStatus] = useState<ImageServiceHealth>(INITIAL);
  const [isChecking, setIsChecking] = useState(false);

  const refresh = useCallback(async () => {
    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/generate-image?url=${encodeURIComponent(sidecarUrl)}`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as ImageServiceHealth;
      setStatus(data);
    } catch {
      setStatus({ status: "offline", message: "Unable to check the image service." });
    } finally {
      setIsChecking(false);
    }
  }, [sidecarUrl]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = () => {
      if (cancelled) return;
      void refresh();
    };

    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  // Report the initial "checking" placeholder while disabled, without writing
  // state from the effect above — nothing to reset once polling never started.
  return { status: enabled ? status : INITIAL, isChecking: enabled && isChecking, refresh };
}
