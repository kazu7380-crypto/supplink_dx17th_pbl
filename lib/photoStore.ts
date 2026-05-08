"use client";

import { del, get, keys, set } from "idb-keyval";

/**
 * Photo storage backed by IndexedDB (via idb-keyval).
 *
 * Keys are derived from item codes. Values are stored as Blobs and
 * exposed to UI as object URLs (caller is responsible for revoking).
 */

function keyFor(code: number): string {
  return `item-photo-${code}`;
}

export async function savePhoto(code: number, blob: Blob): Promise<void> {
  await set(keyFor(code), blob);
  notifyChanged(code);
}

export async function loadPhotoBlob(code: number): Promise<Blob | null> {
  const value = (await get(keyFor(code))) as Blob | undefined;
  return value ?? null;
}

export async function deletePhoto(code: number): Promise<void> {
  await del(keyFor(code));
  notifyChanged(code);
}

export async function listPhotoCodes(): Promise<number[]> {
  const allKeys = (await keys()) as IDBValidKey[];
  const codes: number[] = [];
  for (const k of allKeys) {
    if (typeof k !== "string") continue;
    const m = k.match(/^item-photo-(\d+)$/);
    if (m) codes.push(Number(m[1]));
  }
  return codes;
}

const PHOTO_EVENT = "or-supply-photo-changed";

function notifyChanged(code: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PHOTO_EVENT, { detail: { code } }));
}

export function subscribePhotoChanged(
  handler: (code: number) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = (e: Event) => {
    const detail = (e as CustomEvent<{ code: number }>).detail;
    if (detail) handler(detail.code);
  };
  window.addEventListener(PHOTO_EVENT, onCustom);
  return () => window.removeEventListener(PHOTO_EVENT, onCustom);
}

/**
 * Resize an image File/Blob to fit within the given max dimension while
 * preserving aspect ratio. Returns a JPEG Blob to keep storage compact.
 */
export async function resizeImage(
  source: Blob,
  maxDim = 1024,
  quality = 0.85,
): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return source;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b ?? source),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
