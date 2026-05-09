"use client";

import { getSupabaseBrowser } from "./supabaseBrowser";
import type { Item } from "./types";

/**
 * Item photo storage backed by Supabase Storage (bucket "item-photos")
 * + items.photo_path column.
 *
 * Photos are stored as `<code>.jpg` and the path is recorded on the items
 * row so any client can resolve a public URL synchronously.
 */

const BUCKET = "item-photos";

function pathFor(code: number): string {
  return `${code}.jpg`;
}

/**
 * Upload (or overwrite) a photo for the given item code.
 * 1. Compress / put the blob into Supabase Storage with upsert
 * 2. Update items.photo_path so other clients see the new photo via Realtime
 *
 * `fallback` を渡すと、items テーブルにまだ行が無い場合（バンドル fallback の
 * 物品に写真を付けるケース）に INSERT してから photo_path を設定する。
 */
export async function savePhoto(
  code: number,
  blob: Blob,
  fallback?: {
    name: string;
    spec?: string;
    shelf?: string;
    memo?: string;
    category?: string;
  },
): Promise<void> {
  const sb = getSupabaseBrowser();
  const path = pathFor(code);

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "60",
  });
  if (upErr) {
    console.error("[photoStore.save/upload]", upErr);
    throw upErr;
  }

  // items に該当行があるか確認
  const { data: existing, error: selErr } = await sb
    .from("items")
    .select("code")
    .eq("code", code)
    .maybeSingle();
  if (selErr) {
    console.error("[photoStore.save/items-select]", selErr);
    throw selErr;
  }

  if (existing) {
    const { error: itemErr } = await sb
      .from("items")
      .update({ photo_path: path })
      .eq("code", code);
    if (itemErr) {
      console.error("[photoStore.save/items-update]", itemErr);
      throw itemErr;
    }
    return;
  }

  // 行が無い → バンドル fallback の物品。fallback 情報があれば INSERT。
  if (!fallback) {
    throw new Error(
      `物品コード ${code} が物品マスタに存在しません。先に CSV を取り込んでください。`,
    );
  }
  const { error: insErr } = await sb.from("items").insert({
    code,
    name: fallback.name,
    spec: fallback.spec ?? "",
    shelf: fallback.shelf ?? "",
    memo: fallback.memo ?? "",
    category: fallback.category ?? null,
    photo_path: path,
  });
  if (insErr) {
    console.error("[photoStore.save/items-insert]", insErr);
    throw insErr;
  }
}

/**
 * Delete a photo. Storage failures (e.g. file not found) are swallowed
 * to keep the items row in sync.
 */
export async function deletePhoto(code: number): Promise<void> {
  const sb = getSupabaseBrowser();
  const path = pathFor(code);

  const { error: rmErr } = await sb.storage.from(BUCKET).remove([path]);
  if (rmErr) console.warn("[photoStore.delete/storage]", rmErr);

  const { error: itemErr } = await sb
    .from("items")
    .update({ photo_path: null })
    .eq("code", code);
  if (itemErr) {
    console.error("[photoStore.delete/items-update]", itemErr);
    throw itemErr;
  }
}

/**
 * Build a public URL for an item's photo. Returns null if no photo is
 * registered. Includes a cache-buster derived from items.updated_at so
 * subsequent re-uploads bust the CDN cache.
 */
export function getPublicPhotoUrl(
  item: Pick<Item, "photoPath" | "updatedAt"> | null | undefined,
): string | null {
  if (!item || !item.photoPath) return null;
  let publicUrl: string | undefined;
  try {
    const sb = getSupabaseBrowser();
    publicUrl = sb.storage.from(BUCKET).getPublicUrl(item.photoPath).data
      ?.publicUrl;
  } catch {
    return null;
  }
  if (!publicUrl) return null;
  const v = item.updatedAt ? `?v=${encodeURIComponent(item.updatedAt)}` : "";
  return `${publicUrl}${v}`;
}

/**
 * Compress an image File/Blob to fit under `targetBytes` (default ~80KB).
 * Tries (max-dimension, JPEG quality) combinations from highest to lowest
 * and returns the first that meets the target.
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
      { dim: 800, quality: 0.7 },
      { dim: 800, quality: 0.6 },
      { dim: 640, quality: 0.65 },
      { dim: 640, quality: 0.55 },
      { dim: 512, quality: 0.6 },
      { dim: 512, quality: 0.5 },
      { dim: 400, quality: 0.55 },
      { dim: 400, quality: 0.45 },
    ];

    let best: Blob | null = null;
    for (const { dim, quality } of attempts) {
      const blob = await renderJpeg(img, dim, quality);
      if (blob.size <= targetBytes) return blob;
      if (!best || blob.size < best.size) best = blob;
    }
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
      (b) =>
        b ? resolve(b) : reject(new Error("canvas.toBlob returned null")),
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
