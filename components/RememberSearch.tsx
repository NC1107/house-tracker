"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Makes a search page's filters stick: the current query string is saved to
 * localStorage, and arriving with no query restores the last one.
 */
export default function RememberSearch({ storageKey }: { storageKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const qs = search.toString();
    try {
      if (qs) {
        localStorage.setItem(storageKey, qs);
      } else {
        const saved = localStorage.getItem(storageKey);
        if (saved) router.replace(`${pathname}?${saved}`);
      }
    } catch {
      // Private mode etc.: filters just don't persist.
    }
  }, [search, pathname, router, storageKey]);

  return null;
}
