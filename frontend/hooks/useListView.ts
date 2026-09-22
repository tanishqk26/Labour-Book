"use client";

import { useEffect, useState } from "react";

export type ListView = "cards" | "sheet";

export function useListView(storageKey: string): [ListView, (view: ListView) => void] {
  const [view, setView] = useState<ListView>("cards");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "sheet" || saved === "cards") setView(saved);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function update(next: ListView) {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* ignore */
    }
  }

  return [view, update];
}
