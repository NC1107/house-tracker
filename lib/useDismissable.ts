"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Shared open/close state for popovers and dropdowns: closes on outside
 * click/tap and Escape. Replaces four hand-rolled copies of the same listeners
 * (nav groups, glossary terms, chart info tips, multi-select dropdowns).
 */
export function useDismissable(...refs: RefObject<HTMLElement | null>[]) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return { open, setOpen };
}
