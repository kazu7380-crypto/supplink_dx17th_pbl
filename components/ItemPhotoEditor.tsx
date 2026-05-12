"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import type { Item } from "@/lib/types";
import { compressImage, deletePhoto, getPublicPhotoUrl, savePhoto } from "@/lib/photoStore";
import { PhotoLightbox } from "./PhotoLightbox";

type Props = { item: Item };

const ACCEPT = "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png";

function isHeicLike(file: File): boolean {
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  const t = (file.type || "").toLowerCase();
  return t.includes("heic") || t.includes("heif");
}

export function ItemPhotoEditor({ item }: Props) {
  const code = item.code;
  const url = getPublicPhotoUrl(item);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    if (isHeicLike(file)) {
      setError(
        "HEIC形式は非対応です。iPhoneの設定 → カメラ → フォーマット を「互換性優先」に変更してから撮影し直してください。",
      );
      return;
    }
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png)$/i.test(file.name)) {
      setError(
        `JPG / JPEG / PNG ファイルを選択してください（検出: ${file.type || file.name}）`,
      );
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImage(file, 80_000);
      await savePhoto(code, blob, {
        name: item.name,
        spec: item.spec,
        shelf: item.shelf,
        memo: item.memo,
        category: item.category,
      });
    } catch (err) {
      console.error("[ItemPhotoEditor] save failed", err);
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : String(err);
      setError(`写真の保存に失敗しました: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const onSelectChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleFile(f);
    if (e.target) e.target.value = "";
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    await handleFile(f);
  };

  const onDelete = async () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("この写真を削除しますか？")) return;
    setBusy(true);
    try {
      await deletePhoto(code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-4 transition sm:flex-row",
          dragOver ? "border-ink bg-ink/[0.04]" : "border-ink-line bg-white",
        ].join(" ")}
      >
        {url ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={`${item.name} の写真を拡大`}
            title="写真を拡大"
            className="flex h-32 w-32 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded border border-ink-line bg-gray-50 transition hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="登録済み写真" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-line bg-gray-50">
            <span className="text-xs text-ink-muted">写真なし</span>
          </div>
        )}
        <div className="flex-1 text-sm">
          <div className="text-ink-soft">
            画像をドラッグ&ドロップするか、ボタンから選択してください。
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded border border-ink bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-white disabled:opacity-50"
            >
              <Upload size={14} aria-hidden /> ファイルを選択
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded border border-ink-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
            >
              <Camera size={14} aria-hidden /> カメラで撮影
            </button>
            {url && (
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={14} aria-hidden /> 削除
              </button>
            )}
          </div>
          {busy && <div className="mt-2 text-xs text-ink-muted">処理中...</div>}
          {error && (
            <div className="mt-2 text-xs text-red-700">{error}</div>
          )}
          <div className="mt-2 text-xs text-ink-muted">
            JPG / JPEG / PNG。約 80KB 以下に自動圧縮して保存します。
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onSelectChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="hidden"
        onChange={onSelectChange}
      />
      {zoom && <PhotoLightbox item={item} onClose={() => setZoom(false)} />}
    </div>
  );
}
