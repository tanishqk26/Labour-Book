"use client";

import { useEffect } from "react";

/**
 * Blurs any focused <input type="number"> when the user scrolls over it,
 * so mouse-wheel movement never silently changes an entered amount.
 */
export default function DisableNumberScroll() {
  useEffect(() => {
    function handleWheel(e: WheelEvent) {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.type === "number" && document.activeElement === target) {
        target.blur();
      }
    }
    document.addEventListener("wheel", handleWheel, { passive: true });
    return () => document.removeEventListener("wheel", handleWheel);
  }, []);

  return null;
}
