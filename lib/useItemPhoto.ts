"use client";

import { useEffect, useState } from "react";
import { loadPhotoBlob, subscribePhotoChanged } from "./photoStore";

/**
 * Resolves the photo for a given item code into an object URL.
 * Returns `null` while loading or when the item has no photo stored.
 * The URL is automatically revoked on cleanup or change.
 */
export function useItemPhotoUrl(code: number | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (code == null) {
      setUrl(null);
      return;
    }
    let active = true;
    let currentUrl: string | null = null;

    const apply = async () => {
      const blob = await loadPhotoBlob(code);
      if (!active) return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      if (blob) {
        currentUrl = URL.createObjectURL(blob);
        setUrl(currentUrl);
      } else {
        currentUrl = null;
        setUrl(null);
      }
    };
    apply();

    const unsub = subscribePhotoChanged((changed) => {
      if (changed === code) apply();
    });

    return () => {
      active = false;
      unsub();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [code]);

  return url;
}
