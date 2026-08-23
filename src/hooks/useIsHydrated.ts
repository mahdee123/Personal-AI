"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False during server render and the hydration render, true afterwards.
 *
 * Persisted state is read straight from localStorage in a state initializer,
 * which means the client would otherwise render more than the server did.
 * Gating browser-only UI on this flag keeps the two renders identical without
 * writing state from an effect.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
