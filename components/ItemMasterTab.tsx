"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Download, Image as ImageIcon, Pencil, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import type { Item } from "@/lib/types";
import { downloadCsv, timestampForFilename } from "@/lib/csv";
import { useItems } from "@/lib/useItems";
import { ItemPhotoEditor } from "./ItemPhotoEditor";
import { ItemPhotoThumb } from "./ItemPhotoThumb";

type Props = { defaultItems: Item[] };

type Preview = {
  rows: Item[];
  warnings: string[];
};

type CsvField = "code" | "name" | "spec" | "shelf" | "memo" | "category";
const FIELD_ALIASES: Record<CsvField, string[]> = {
  code: ["物品コード", "コード", "code"],
  name: ["物品名", "材料名", "品名", "名前", "name"],
  spec: ["規格製品番号", "製品番号", "製品記号", "規格", "spec"],
  shelf: ["棚番", "棚番号", "棚", "shelf"],
  memo: ["メモ", "備考", "memo"],
  category: ["カテゴリ", "カテゴリー", "分類", "category"],
};
const CORE_STOCK_ALIASES = ["現在庫数", "現在庫", "在庫数", "current_stock", "stock"];
const CORE_CONSTANT_ALIASES = ["定数", "基準数", "par_stock", "constant"];
const ITEM_LIST_PAGE_SIZE = 100;

export function ItemMasterTab({ defaultItems }: Props) {
  const items = useItems(defaultItems);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coreStockFileRef = useRef<HTMLInputElement>(null);
  const coreShelfFileRef = useRef<HTMLInputElement>(null);
  const [coreStockFile, setCoreStockFile] = useState<File | null>(null);
  const [coreShelfFile, setCoreShelfFile] = useState<File | null>(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [listPage, setListPage] = useState(0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return Array.from(set).sort();
  }, [items]);

  const [categoryFilter, setCategoryFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter && i.category !== categoryFilter) return false;
      if (!q) return true;
      const hay = `${i.code} ${i.name} ${i.spec} ${i.shelf} ${i.memo} ${i.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filter, categoryFilter]);

  useEffect(() => {
    setListPage(0);
  }, [filter, categoryFilter, items]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEM_LIST_PAGE_SIZE));
  const visibleItems = filtered.slice(
    listPage * ITEM_LIST_PAGE_SIZE,
    (listPage + 1) * ITEM_LIST_PAGE_SIZE,
  );

  const handleFile = async (file: File) => {
    setParseError(null);
    setPreview(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      if (wb.SheetNames.length === 0) {
        setParseError("シートが見つかりませんでした");
        return;
      }
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      const result = mapRows(raw);
      setPreview(result);
    } catch (err) {
      console.error(err);
      setParseError("ファイルの読み込みに失敗しました。形式が CSV / Excel / TSV か確認してください。");
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onCoreFileChange = (kind: "stock" | "shelf") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (kind === "stock") setCoreStockFile(file);
    else setCoreShelfFile(file);
    e.target.value = "";
  };

  const generateFromCoreFiles = async () => {
    if (!coreStockFile || !coreShelfFile) return;
    setParseError(null);
    setPreview(null);
    try {
      const [stockRows, shelfRows] = await Promise.all([
        readSpreadsheetRows(coreStockFile),
        readSpreadsheetRows(coreShelfFile),
      ]);
      const firstStockCode = stockRows.length > 0
        ? pick(stockRows[0], FIELD_ALIASES.code)
        : undefined;
      console.log("[基幹マスタ取込] 在庫マスタリスト.csv 1行目の物品コード", {
        raw: firstStockCode,
        trimmed: firstStockCode == null ? "" : String(firstStockCode).trim(),
      });
      const result = mapCoreRows(stockRows, shelfRows);
      setPreview(result);
    } catch (err) {
      console.error(err);
      setParseError("基幹マスタの読み込みに失敗しました。CSV / Excel / TSV の形式を確認してください。");
    }
  };

  const applyPreview = async () => {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: preview.rows }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === "string" ? body.error : "save failed",
        );
      }
      setSavedFlash(`物品マスタを更新しました（${preview.rows.length} 件）`)
      setPreview(null);

      setTimeout(() => {
        window.location.reload();
      }, 1000);   

      window.setTimeout(() => setSavedFlash(null), 4000);
      
    } catch (e) {
      console.error(e);
      setSaveError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
    setParseError(null);
    setSaveError(null);
  };

  const exportCsv = () => {
    const sorted = [...items].sort((a, b) => a.code - b.code);
    const rows = sorted.map((it) => [
      it.code,
      it.name,
      it.spec,
      it.shelf,
      it.currentStock ?? "",
      it.parStock ?? "",
      it.memo,
      it.category ?? "",
    ]);
    downloadCsv(
      `items-master-${timestampForFilename()}.csv`,
      ["物品コード", "材料名", "製品番号", "棚番", "現在庫数", "定数", "メモ", "カテゴリ"],
      rows,
    );
  };

  return (
    <div>
      <Section title="インポート / エクスポート" description="CSV / TSV / Excel を読み込んで物品マスタを更新します。データはサーバ（Supabase）に保存され、全端末で共有されます。列の見出しは「物品コード / 材料名 / 製品番号 / 棚番 / メモ / カテゴリ」を想定しています。「CSV エクスポート」では現在のマスタを同じ列順で書き出します（UTF-8 BOM 付き）。">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex w-48 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded border border-ink bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-ink hover:text-white">
            <Upload size={16} aria-hidden /> ファイルインポート
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={items.length === 0}
            className="inline-flex w-48 items-center justify-center gap-2 whitespace-nowrap rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={14} aria-hidden /> CSV エクスポート
          </button>
          <div className="flex w-full flex-wrap items-center gap-2 rounded border border-ink-line bg-gray-50 p-2 sm:w-auto">
            <span className="w-full text-xs font-semibold text-ink-soft sm:w-auto">基幹マスタ取込</span>
            <label className="inline-flex cursor-pointer items-center justify-center rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-gray-100">
              在庫マスタリスト.csv
              <input ref={coreStockFileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values" className="hidden" onChange={onCoreFileChange("stock")} />
            </label>
            <label className="inline-flex cursor-pointer items-center justify-center rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-gray-100">
              棚番定数入出力ファイル.csv
              <input ref={coreShelfFileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv,text/tab-separated-values" className="hidden" onChange={onCoreFileChange("shelf")} />
            </label>
            <button type="button" onClick={generateFromCoreFiles} disabled={!coreStockFile || !coreShelfFile} className="inline-flex items-center justify-center rounded bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300">
              items-masterを生成
            </button>
            {(coreStockFile || coreShelfFile) && (
              <span className="w-full text-xs text-ink-muted">
                {coreStockFile ? "在庫: 選択済み" : "在庫: 未選択"} / {coreShelfFile ? "棚番: 選択済み" : "棚番: 未選択"}
              </span>
            )}
          </div>
          {savedFlash && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
              {savedFlash}
            </span>
          )}
        </div>

        {parseError && (
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle size={14} aria-hidden /> {parseError}
          </div>
        )}
        {saveError && (
          <div className="mt-3 inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertCircle size={14} aria-hidden /> {saveError}
          </div>
        )}

        {preview && (
          <div className="mt-3 rounded-lg border border-ink-line bg-white p-3">
            <div className="text-sm font-semibold">プレビュー: {preview.rows.length} 件</div>
            {preview.warnings.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
                {preview.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
                {preview.warnings.length > 5 && (
                  <li>ほか {preview.warnings.length - 5} 件の警告</li>
                )}
              </ul>
            )}
            <div className="mt-2 max-h-48 overflow-auto rounded border border-ink-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-left text-ink-muted">
                  <tr>
                    <th className="px-2 py-1">コード</th>
                    <th className="px-2 py-1">名前</th>
                    <th className="px-2 py-1">仕様</th>
                    <th className="px-2 py-1">棚</th>
                    <th className="px-2 py-1">現在庫</th>
                    <th className="px-2 py-1">定数</th>
                    <th className="px-2 py-1">カテゴリ</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((r) => (
                    <tr key={r.code} className="border-t border-ink-line">
                      <td className="px-2 py-1 tabular-nums">{r.code}</td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 text-ink-soft">{r.spec}</td>
                      <td className="px-2 py-1 text-ink-soft">{r.shelf}</td>
                      <td className="px-2 py-1 text-ink-soft">{r.currentStock ?? ""}</td>
                      <td className="px-2 py-1 text-ink-soft">{r.parStock ?? ""}</td>
                      <td className="px-2 py-1 text-ink-soft">{r.category ?? ""}</td>
                    </tr>
                  ))}
                  {preview.rows.length > 50 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-1 text-center text-ink-muted">
                        ... ほか {preview.rows.length - 50} 件
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelPreview}
                disabled={saving}
                className="rounded border border-ink-line bg-white px-3 py-1.5 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={applyPreview}
                disabled={saving}
                className="rounded bg-ink px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? "保存中..." : "この内容で更新"}
              </button>
            </div>
          </div>
        )}
      </Section>

      <Section title={`物品一覧 (${items.length} 件)`} description="行をタップすると写真の登録 / 変更とメモの編集ができます。">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="text"
            placeholder="名前・棚・コード等で検索"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded border border-ink-line bg-white px-3 py-2 text-sm sm:w-64"
          />
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded border border-ink-line bg-white px-2 py-2 text-sm sm:py-1.5"
            >
              <option value="">すべてのカテゴリ</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-ink-muted">
            {filtered.length} 件中 {visibleItems.length} 件表示
          </span>
        </div>

        <ul className="space-y-2">
          {visibleItems.map((it) => {
            const open = expandedCode === it.code;
            return (
              <li
                key={it.code}
                className="overflow-hidden rounded-lg border border-ink-line bg-white"
              >
                <button
                  type="button"
                  onClick={() => setExpandedCode(open ? null : it.code)}
                  aria-expanded={open}
                  className="flex w-full items-start gap-3 p-3 text-left hover:bg-gray-50"
                >
                  <div className="shrink-0">
                    <ItemPhotoThumb item={it} size={56} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-[11px] font-medium tracking-wide text-ink-muted">
                      <span className="truncate uppercase">{it.category ?? ""}</span>
                      <span className="shrink-0 tabular-nums">#{it.code}</span>
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                      {it.name}
                    </div>
                    <div className="truncate text-xs text-ink-soft">
                      {it.spec}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-bold text-ink">{it.shelf}</span>
                      {it.memo && (
                        <span className="text-ink-muted">メモ: {it.memo}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 self-center text-ink-muted">
                    {open ? (
                      <ChevronDown size={16} aria-hidden />
                    ) : (
                      <ChevronRight size={16} aria-hidden />
                    )}
                  </div>
                </button>
                {open && (
                  <div className="space-y-4 border-t border-ink-line bg-gray-50 p-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <ImageIcon size={14} aria-hidden /> 写真の登録 / 変更
                      </div>
                      <div className="mt-2">
                        <ItemPhotoEditor item={it} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <Pencil size={14} aria-hidden /> メモの編集
                      </div>
                      <div className="mt-2">
                        <MemoEditor item={it} />
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {filtered.length > ITEM_LIST_PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setListPage((page) => Math.max(0, page - 1))}
              disabled={listPage === 0}
              className="rounded border border-ink-line bg-white px-3 py-1.5 text-ink-soft hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              前へ
            </button>
            <span className="text-xs tabular-nums text-ink-muted">
              {listPage + 1} / {pageCount} ページ
            </span>
            <button
              type="button"
              onClick={() => setListPage((page) => Math.min(pageCount - 1, page + 1))}
              disabled={listPage >= pageCount - 1}
              className="rounded border border-ink-line bg-white px-3 py-1.5 text-ink-soft hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed border-ink-line bg-white p-6 text-center text-sm text-ink-muted">
            該当する物品はありません
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-1 text-sm font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mb-3 text-xs text-ink-soft">{description}</p>
      )}
      {children}
    </section>
  );
}

function mapRows(raw: Record<string, unknown>[]): Preview {
  const warnings: string[] = [];
  const rows: Item[] = [];
  const seenCodes = new Set<number>();

  raw.forEach((r, idx) => {
    const lineNo = idx + 2; // 1-based + header

    const codeRaw = pick(r, FIELD_ALIASES.code);
    const code = toCode(codeRaw);
    if (code == null) {
      warnings.push(`${lineNo}行目: 物品コードが数値ではないためスキップしました`);
      return;
    }
    if (seenCodes.has(code)) {
      warnings.push(`${lineNo}行目: 物品コード ${code} が重複しています（後の行を採用）`);
    }
    seenCodes.add(code);

    const name = String(pick(r, FIELD_ALIASES.name) ?? "").trim();
    if (!name) {
      warnings.push(`${lineNo}行目: 材料名が空です`);
    }

    const spec = String(pick(r, FIELD_ALIASES.spec) ?? "").trim();
    const shelf = String(pick(r, FIELD_ALIASES.shelf) ?? "").trim();
    const currentStock = toOptionalNumber(pick(r, CORE_STOCK_ALIASES));
    const constant = toOptionalNumber(pick(r, CORE_CONSTANT_ALIASES));
    const memo = String(pick(r, FIELD_ALIASES.memo) ?? "").trim();
    const categoryRaw = String(pick(r, FIELD_ALIASES.category) ?? "").trim();

    rows.push({
      code,
      name,
      spec,
      shelf,
      currentStock,
      parStock: constant,
      memo,
      category: categoryRaw || undefined,
    });
  });

  // de-duplicate by code (last wins, since we want to honor the warning's "後の行を採用")
  const map = new Map<number, Item>();
  for (const r of rows) map.set(r.code, r);
  return { rows: Array.from(map.values()), warnings };
}

async function readSpreadsheetRows(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const isTextFile = /\.(csv|tsv)$/i.test(file.name) ||
    file.type === "text/csv" ||
    file.type === "text/tab-separated-values";
  const wb = isTextFile
    ? XLSX.read(decodeCsvBuffer(buf), { type: "string" })
    : XLSX.read(buf, { type: "array" });
  if (wb.SheetNames.length === 0) throw new Error("sheet not found");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], {
    defval: "",
  });
}

function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    // UTF-8として不正なバイト列なら、CP932（Shift-JIS）へフォールバックする。
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("shift-jis").decode(bytes).replace(/^\uFEFF/, "");
  }
}

function mapCoreRows(
  stockRaw: Record<string, unknown>[],
  shelfRaw: Record<string, unknown>[],
): Preview {
  const shelfByCode = new Map<number, string>();
  const warnings: string[] = [];

  shelfRaw.forEach((row, idx) => {
    const code = toCode(pick(row, FIELD_ALIASES.code));
    if (code == null) return;
    const shelf = String(pick(row, FIELD_ALIASES.shelf) ?? "").trim();
    shelfByCode.set(code, shelf);
    if (!shelf) warnings.push(`棚番ファイル ${idx + 2}行目: 棚番が空です`);
  });

  const rows: Item[] = [];
  const seenCodes = new Set<number>();
  stockRaw.forEach((row, idx) => {
    if (idx === 0) {
      console.log("DEBUG_KEYS", Object.keys(row));
      console.log("DEBUG_ROW", row);
    }
    const lineNo = idx + 2;
    const code = toCode(pick(row, FIELD_ALIASES.code));
    if (code == null) {
      warnings.push(`${lineNo}行目: 物品コードが数値ではないためスキップしました`);
      return;
    }
    if (seenCodes.has(code)) warnings.push(`${lineNo}行目: 物品コード ${code} が重複しています（後の行を採用）`);
    seenCodes.add(code);

    const name = String(pick(row, FIELD_ALIASES.name) ?? "").trim();
    if (!name) warnings.push(`${lineNo}行目: 材料名が空です`);
    const currentStock = toOptionalNumber(pick(row, CORE_STOCK_ALIASES));
    const constant = toOptionalNumber(pick(row, CORE_CONSTANT_ALIASES));
    if (currentStock == null && pick(row, CORE_STOCK_ALIASES) !== undefined) {
      warnings.push(`${lineNo}行目: 現在庫数が数値ではありません`);
    }
    if (constant == null && pick(row, CORE_CONSTANT_ALIASES) !== undefined) {
      warnings.push(`${lineNo}行目: 定数が数値ではありません`);
    }
    rows.push({
      code,
      name,
      spec: String(pick(row, FIELD_ALIASES.spec) ?? "").trim(),
      shelf: shelfByCode.get(code) ?? "",
      currentStock,
      parStock: constant,
      memo: "",
      category: undefined,
    });
  });

  const map = new Map<number, Item>();
  for (const row of rows) map.set(row.code, row);
  return { rows: Array.from(map.values()), warnings };
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== "" && row[k] != null) return row[k];
    // 見出しの前後空白・BOM・大文字小文字を吸収する。
    for (const actual of Object.keys(row)) {
      const normalizedActual = actual.replace(/^\uFEFF/, "").trim().toLowerCase();
      if (normalizedActual === k.toLowerCase() && row[actual] !== "" && row[actual] != null) {
        return row[actual];
      }
    }
  }
  return undefined;
}

function toCode(value: unknown): number | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const number = Number(value.trim());
    if (Number.isFinite(number)) return Math.trunc(number);
  }
  return undefined;
}

const MEMO_MAX_LEN = 500;

function MemoEditor({ item }: { item: Item }) {
  const [draft, setDraft] = useState(item.memo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // 外部（他端末・他タブの編集）で memo が変わったらドラフトも追従する。
  // 編集中に上書きされる可能性はあるが、本アプリの想定では同時編集は稀。
  useEffect(() => {
    setDraft(item.memo ?? "");
  }, [item.memo, item.code]);

  const trimmed = draft.replace(/\s+$/g, "");
  const dirty = trimmed !== (item.memo ?? "");

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === "string" ? body.error : "保存に失敗しました",
        );
      }
      setFlash("メモを更新しました");
      window.setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(item.memo ?? "");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={MEMO_MAX_LEN}
        rows={2}
        placeholder="メモなし"
        className="w-full resize-y rounded border border-ink-line bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-muted tabular-nums">
          {draft.length} / {MEMO_MAX_LEN}
        </span>
        <div className="flex items-center gap-2">
          {flash && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              {flash}
            </span>
          )}
          {dirty && !saving && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-ink-line bg-white px-3 py-1 text-xs text-ink-soft hover:bg-gray-50"
            >
              変更を破棄
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="rounded bg-ink px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving ? "保存中..." : "メモを保存"}
          </button>
        </div>
      </div>
      {error && (
        <div className="inline-flex items-center gap-2 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800">
          <AlertCircle size={12} aria-hidden /> {error}
        </div>
      )}
    </div>
  );
}
