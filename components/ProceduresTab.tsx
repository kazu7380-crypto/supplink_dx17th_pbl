"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadCsv, timestampForFilename } from "@/lib/csv";
import type { Procedure } from "@/lib/types";
import { useProcedures } from "@/lib/useProcedures";

type Preview = {
  rows: { department: string; name: string }[];
  warnings: string[];
};

const FIELD_ALIASES = {
  department: ["診療科", "診療科目", "department", "dept"],
  name: ["術式", "手術名", "procedure", "name"],
};

export function ProceduresTab() {
  const procedures = useProcedures();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const p of procedures) set.add(p.department);
    return Array.from(set).sort();
  }, [procedures]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return procedures.filter((p) => {
      if (departmentFilter && p.department !== departmentFilter) return false;
      if (!q) return true;
      return `${p.department} ${p.name}`.toLowerCase().includes(q);
    });
  }, [procedures, filter, departmentFilter]);

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
      setPreview(mapRows(raw));
    } catch (err) {
      console.error(err);
      setParseError(
        "ファイルの読み込みに失敗しました。形式が CSV / Excel / TSV か確認してください。",
      );
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await handleFile(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  const applyPreview = async () => {
    if (!preview) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: preview.rows }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body?.error === "string" ? body.error : "save failed",
        );
      }
      setSavedFlash(`診療科・術式を更新しました（${preview.rows.length} 件）`);
      window.setTimeout(() => setSavedFlash(null), 4000);
      setPreview(null);
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
    const sorted = [...procedures].sort((a, b) => {
      const d = a.department.localeCompare(b.department, "ja");
      return d !== 0 ? d : a.name.localeCompare(b.name, "ja");
    });
    const rows = sorted.map((p) => [p.department, p.name]);
    downloadCsv(
      `procedures-master-${timestampForFilename()}.csv`,
      ["診療科", "術式"],
      rows,
    );
  };

  return (
    <div>
      <Section
        title="インポート / エクスポート"
        description="A 列「診療科」、B 列「術式」の CSV / TSV / Excel を読み込みます。データはサーバ（Supabase）に保存され、全端末で共有されます。「CSV エクスポート」で現在のマスタを同じ列順で書き出します（UTF-8 BOM 付き）。"
      >
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
            disabled={procedures.length === 0}
            className="inline-flex w-48 items-center justify-center gap-2 whitespace-nowrap rounded border border-ink-line bg-white px-3 py-2 text-sm text-ink-soft hover:bg-gray-50 disabled:opacity-50"
          >
            <Download size={14} aria-hidden /> CSV エクスポート
          </button>
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
            <div className="text-sm font-semibold">
              プレビュー: {preview.rows.length} 件
            </div>
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
                    <th className="px-2 py-1">診療科</th>
                    <th className="px-2 py-1">術式</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-ink-line">
                      <td className="px-2 py-1">{r.department}</td>
                      <td className="px-2 py-1">{r.name}</td>
                    </tr>
                  ))}
                  {preview.rows.length > 50 && (
                    <tr>
                      <td colSpan={2} className="px-2 py-1 text-center text-ink-muted">
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

      <Section title={`登録済み (${procedures.length} 件)`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="text"
            placeholder="診療科・術式名で検索"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full rounded border border-ink-line bg-white px-3 py-2 text-sm sm:w-64"
          />
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="rounded border border-ink-line bg-white px-2 py-2 text-sm sm:py-1.5"
            >
              <option value="">すべての診療科</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-ink-muted">
            {filtered.length} 件表示
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-ink-line bg-white p-6 text-center text-sm text-ink-muted">
            {procedures.length === 0
              ? "未登録です。CSV / Excel を取り込んでください。"
              : "該当する術式はありません"}
          </div>
        ) : (
          <div className="space-y-4">
            {groupByDepartment(filtered).map(({ department, items }) => (
              <section key={department}>
                <h3 className="mb-1 text-sm font-semibold text-ink">
                  {department}
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    ({items.length})
                  </span>
                </h3>
                <ul className="space-y-1">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="rounded border border-ink-line bg-white px-3 py-2 text-sm"
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
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
  const rows: { department: string; name: string }[] = [];
  const seen = new Set<string>();

  raw.forEach((r, idx) => {
    const lineNo = idx + 2;
    const department = String(pick(r, FIELD_ALIASES.department) ?? "").trim();
    const name = String(pick(r, FIELD_ALIASES.name) ?? "").trim();

    if (!department && !name) return;
    if (!department) {
      warnings.push(`${lineNo}行目: 診療科が空のためスキップしました`);
      return;
    }
    if (!name) {
      warnings.push(`${lineNo}行目: 術式が空のためスキップしました`);
      return;
    }
    const key = `${department}\x00${name}`;
    if (seen.has(key)) {
      warnings.push(
        `${lineNo}行目: ${department} / ${name} は重複しているためスキップしました`,
      );
      return;
    }
    seen.add(key);
    rows.push({ department, name });
  });

  return { rows, warnings };
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== "" && row[k] != null) return row[k];
    for (const actual of Object.keys(row)) {
      if (
        actual.toLowerCase() === k.toLowerCase() &&
        row[actual] !== "" &&
        row[actual] != null
      ) {
        return row[actual];
      }
    }
  }
  return undefined;
}

/**
 * 診療科ごとにグルーピングする。診療科の登場順は元配列の順序を保ち、
 * 各グループ内の術式順序も元配列の順序を保つ（ソートは呼び出し側で済ませる想定）。
 */
function groupByDepartment(
  rows: Procedure[],
): Array<{ department: string; items: Procedure[] }> {
  const map = new Map<string, Procedure[]>();
  for (const p of rows) {
    const arr = map.get(p.department);
    if (arr) arr.push(p);
    else map.set(p.department, [p]);
  }
  return Array.from(map, ([department, items]) => ({ department, items }));
}
