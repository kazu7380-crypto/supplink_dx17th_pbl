"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartLine } from "@/lib/types";

const ROOM_KEY = "or-room";
const CART_KEY = "or-cart";

type RoomCtx = {
  room: string;
  setRoom: (r: string) => void;
  ready: boolean;
};

const RoomContext = createContext<RoomCtx | null>(null);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoomState] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(ROOM_KEY) ?? "";
    setRoomState(stored);
    setReady(true);
  }, []);

  const setRoom = useCallback((r: string) => {
    setRoomState(r);
    sessionStorage.setItem(ROOM_KEY, r);
  }, []);

  const value = useMemo(() => ({ room, setRoom, ready }), [room, setRoom, ready]);
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomCtx {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoom must be used inside RoomProvider");
  return ctx;
}

type CartCtx = {
  lines: CartLine[];
  add: (itemCode: number, quantity: number) => void;
  setQuantity: (itemCode: number, quantity: number) => void;
  remove: (itemCode: number) => void;
  clear: () => void;
  count: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) setLines(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const add = useCallback((itemCode: number, quantity: number) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.itemCode === itemCode);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [...prev, { itemCode, quantity }];
    });
  }, []);

  const setQuantity = useCallback((itemCode: number, quantity: number) => {
    if (quantity <= 0) {
      setLines((prev) => prev.filter((l) => l.itemCode !== itemCode));
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.itemCode === itemCode ? { ...l, quantity } : l)),
    );
  }, []);

  const remove = useCallback((itemCode: number) => {
    setLines((prev) => prev.filter((l) => l.itemCode !== itemCode));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const count = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines],
  );

  const value = useMemo(
    () => ({ lines, add, setQuantity, remove, clear, count, isOpen, open, close }),
    [lines, add, setQuantity, remove, clear, count, isOpen, open, close],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
