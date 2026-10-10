"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { RatingSystem } from "@/lib/site-data";

// The chosen scale is a per-viewer preference, so it lives in localStorage and applies on every
// page. Static pages render the default first, then switch once the browser has read it.
const KEY = "f1-ratings:scale";
const EVENT = "f1-ratings:scale-change";

function read(): RatingSystem {
  try {
    return window.localStorage.getItem(KEY) === "recentred" ? "recentred" : "default";
  } catch {
    return "default";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(next: RatingSystem) {
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // Storage blocked (private mode etc.): the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

const ScaleContext = createContext<{ system: RatingSystem; setSystem: (s: RatingSystem) => void }>({
  system: "default",
  setSystem: () => {},
});

export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const system = useSyncExternalStore(subscribe, read, () => "default" as RatingSystem);
  return <ScaleContext.Provider value={{ system, setSystem: write }}>{children}</ScaleContext.Provider>;
}

export const useScale = () => useContext(ScaleContext);
