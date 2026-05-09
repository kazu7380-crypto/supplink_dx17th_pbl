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
 * Compress an image File/Blob to fit under `targetBytes` (default ~80KB).
 *
 * Tries a series of (max-dimension, JPEG quality) combinations from
 * highest to lowest and returns the first that meets the target.
 * If none meet the target, returns the smallest result obtained.
 *
 * Aspect ratio is preserved. Output is always JPEG for compactness.
 */
export async function compressImage(
  source: Blob,
  targetBytes = 80_000,
): Promise<Blob> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);

    const attempts: Array<{ dim: number; quality: number }> = [
      { dim: 1024, quality: 0.7 },
      { dim: 800,  quality: 0.7 },
      { dim: 800,  quality: 0.6 },
      { dim: 640,  quality: 0.65 },
      { dim: 640,  quality: 0.55 },
      { dim: 512,  quality: 0.6 },
      { dim: 512,  quality: 0.5 },
      { dim: 400,  quality: 0.55 },
      { dim: 400,  quality: 0.45 },
    ];

    let best: Blob | null = null;
    for (const { dim, quality } of attempts) {
      const blob = await renderJpeg(img, dim, quality);
      if (blob.size <= targetBytes) return blob;
      if (!best || blob.size < best.size) best = blob;
    }
    // 目標未達でも一番小さいものを返す（元画像にフォールバック）
    return best ?? source;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function renderJpeg(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
): Promise<Blob> {
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context is unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
