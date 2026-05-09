"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload } from "lucide-react";
import { useItemPhotoUrl } from "@/lib/useItemPhoto";
import { compressImage, deletePhoto, savePhoto } from "@/lib/photoStore";

type Props = { code: number };

const ACCEPT = "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png";

export function ItemPhotoEditor({ code }: Props) {
  const url = useItemPhotoUrl(code);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png)$/i.test(file.name)) {
      setError("JPG / JPEG / PNG ファイルを選択してください");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressImage(file, 80_000);
      await savePhoto(code, blob);
    } catch (err) {
      console.error(err);
      setError("写真の保存に失敗しました");
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
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded border border-ink-line bg-gray-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="登録済み写真" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-muted">写真なし</span>
          )}
        </div>
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
    </div>
  );
}
