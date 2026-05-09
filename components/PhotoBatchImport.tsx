"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileImage, ImageOff, AlertCircle, Upload } from "lucide-react";
import type { Item } from "@/lib/types";
import { compressImage, savePhoto } from "@/lib/photoStore";

type Props = { items: Item[] };

type RowStatus = "pending" | "success" | "no-match" | "format-error" | "save-error";

type Row = {
  filename: string;
  code: number | null;
  status: RowStatus;
  message?: string;
};

const ACCEPT = "image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png";

export function PhotoBatchImport({ items }: Props) {
  const itemByCode = useMemo(
    () => new Map(items.map((i) => [i.code, i])),
    [items],
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    const s = { total: rows.length, success: 0, noMatch: 0, error: 0, pending: 0 };
    for (const r of rows) {
      if (r.status === "success") s.success += 1;
      else if (r.status === "no-match") s.noMatch += 1;
      else if (r.status === "format-error" || r.status === "save-error") s.error += 1;
      else if (r.status === "pending") s.pending += 1;
    }
    return s;
  }, [rows]);

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const initial: Row[] = files.map((f) => ({
      filename: f.name,
      code: parseCodeFromFilename(f.name),
      status: "pending",
    }));
    setRows(initial);
    setBusy(true);

    // Process sequentially so progress is observable and UI stays responsive
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const row = initial[i];
      const update = (patch: Partial<Row>) => {
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
      };

      if (!isImageFile(file)) {
        update({ status: "format-error", message: "JPG/PNG ではありません" });
        continue;
      }
      if (row.code == null) {
        update({ status: "no-match", message: "ファイル名から物品コードを抽出できませんでした" });
        continue;
      }
      const matchingItem = itemByCode.get(row.code);
      if (!matchingItem) {
        update({ status: "no-match", message: `物品コード ${row.code} が物品マスタに存在しません` });
        continue;
      }

      try {
        const blob = await compressImage(file, 80_000);
        await savePhoto(row.code, blob, {
          name: matchingItem.name,
          spec: matchingItem.spec,
          shelf: matchingItem.shelf,
          memo: matchingItem.memo,
          category: matchingItem.category,
        });
        update({ status: "success" });
      } catch (err) {
        console.error(err);
        const msg = err instanceof Error ? err.message : "保存に失敗しました";
        update({ status: "save-error", message: msg });
      }
    }

    setBusy(false);
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    if (e.target) e.target.value = "";
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  const reset = () => {
    setRows([]);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-6 text-sm sm:flex-row",
          dragOver ? "border-ink bg-ink/[0.04]" : "border-ink-line bg-white",
        ].join(" ")}
      >
        <FileImage size={32} aria-hidden className="text-ink-muted" />
        <div className="flex-1 text-ink-soft">
          <div>
            ファイル名が物品コードに対応した画像をまとめて取り込みます。
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            例: <code className="rounded bg-gray-100 px-1">100.jpg</code> →
            物品コード 100 に登録。
            ファイル名の先頭の数字を物品コードとして読み取ります（
            <code className="rounded bg-gray-100 px-1">100_xxx.png</code> 等もOK）。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded border border-ink bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-ink hover:text-white disabled:opacity-50"
          >
            <Upload size={14} aria-hidden /> ファイルを選択
          </button>
          {rows.length > 0 && !busy && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-gray-50"
            >
              結果をクリア
            </button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={onFileChange}
      />

      {rows.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink-line bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-line px-3 py-2 text-xs">
            <span className="font-semibold">取り込み結果</span>
            <span className="text-ink-muted">合計 {summary.total} 件</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 size={12} aria-hidden /> 成功 {summary.success}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <ImageOff size={12} aria-hidden /> 未マッチ {summary.noMatch}
            </span>
            {summary.error > 0 && (
              <span className="inline-flex items-center gap-1 text-red-700">
                <AlertCircle size={12} aria-hidden /> エラー {summary.error}
              </span>
            )}
            {busy && (
              <span className="text-ink-muted">処理中... {summary.pending} 件残</span>
            )}
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-left text-ink-muted">
                <tr>
                  <th className="px-3 py-1">ファイル名</th>
                  <th className="px-3 py-1">物品コード</th>
                  <th className="px-3 py-1">結果</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="border-t border-ink-line">
                    <td className="max-w-[260px] truncate px-3 py-1" title={r.filename}>
                      {r.filename}
                    </td>
                    <td className="px-3 py-1 tabular-nums text-ink-soft">
                      {r.code ?? "-"}
                    </td>
                    <td className="px-3 py-1">
                      <StatusCell row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusCell({ row }: { row: Row }) {
  switch (row.status) {
    case "pending":
      return <span className="text-ink-muted">処理待ち</span>;
    case "success":
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 size={12} aria-hidden /> 登録
        </span>
      );
    case "no-match":
      return (
        <span className="inline-flex items-center gap-1 text-amber-700">
          <ImageOff size={12} aria-hidden /> {row.message ?? "未マッチ"}
        </span>
      );
    case "format-error":
    case "save-error":
      return (
        <span className="inline-flex items-center gap-1 text-red-700">
          <AlertCircle size={12} aria-hidden /> {row.message ?? "エラー"}
        </span>
      );
  }
}

function isImageFile(file: File): boolean {
  if (file.type === "image/jpeg" || file.type === "image/png") return true;
  return /\.(jpe?g|png)$/i.test(file.name);
}

function parseCodeFromFilename(name: string): number | null {
  // strip path components if any (e.g. dropped folder paths)
  const base = name.replace(/^.*[\\/]/, "");
  // strip extension
  const stem = base.replace(/\.[^.]+$/, "");
  // take leading digit run
  const m = stem.match(/^(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
