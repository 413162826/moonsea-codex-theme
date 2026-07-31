"use client";

import { useSyncExternalStore } from "react";
import {
  resolveClientTarget,
  type ClientTarget,
} from "../lib/client-target";

const STORAGE_KEY = "moonsea_client_target";
const listeners = new Set<() => void>();
let currentTarget: ClientTarget = "codex";
let browserStateLoaded = false;

function getBrowserSnapshot() {
  if (!browserStateLoaded) {
    const queryTarget = new URLSearchParams(window.location.search).get("client");
    currentTarget = resolveClientTarget(
      queryTarget ?? window.localStorage.getItem(STORAGE_KEY),
    );
    browserStateLoaded = true;
  }
  return currentTarget;
}

function getServerSnapshot(): ClientTarget {
  return "codex";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClientTarget() {
  return useSyncExternalStore(
    subscribe,
    getBrowserSnapshot,
    getServerSnapshot,
  );
}

export function setClientTarget(target: ClientTarget) {
  if (target === getBrowserSnapshot()) return;
  currentTarget = target;
  window.localStorage.setItem(STORAGE_KEY, target);
  const url = new URL(window.location.href);
  url.searchParams.set("client", target);
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((listener) => listener());
}
