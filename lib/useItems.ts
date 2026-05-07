"use client";

import { useEffect, useState } from "react";
import type { Item } from "./types";
import { loadItemsOverride, subscribeItemsChanged } from "./itemsStore";

/**
 * Returns the active item master, preferring the localStorage override
 * (set via the settings page) over the server-supplied defaults.
 *
 * On first render the defaults are used so SSR markup matches; after
 * hydration the hook re-renders with the override (if any).
 */
export function useItems(defaults: Item[]): Item[] {
  const [items, setItems] = useState<Item[]>(defaults);

  useEffect(() => {
    const apply = () => {
      const override = loadItemsOverride();
      setItems(override ?? defaults);
    };
    apply();
    return subscribeItemsChanged(apply);
  }, [defaults]);

  return items;
}
