"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/lib/csv";

type AggregationRow = {
  createdAt: string;
  department: string;
  procedure: string;
  itemCode: number;
  itemName: string;
  quantity: number;
};

const CSV_HEADERS = ["依頼日時", "診療科", "術式", "物品コード", "物品名", "数量"];

export function AggregationTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (from && to && from > to) {
      setError("開始日は終了日以前にしてください。");
      return;
    }

    setIsExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/orders/aggregation?${params.toString()}`);
      const payload = (await response.json()) as
        | { rows: AggregationRow[] }
        | { error: string };
      if (!response.ok || !("rows" in payload)) {
        throw new Error("error" in payload ? payload.error : "集計データの取得に失敗しました。");
      }

      const rows = payload.rows.map((row) => [
        formatDateTime(row.createdAt),
        row.department,
        row.procedure,
        row.itemCode,
        row.itemName,
        row.quantity,
      ]);
      const today = new Date();
      const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      downloadCsv(`術式別追加物品集計_${date}.csv`, CSV_HEADERS, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV出力に失敗しました。");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-line bg-white p-4 sm:p-6">
      <h2 className="text-lg font-semibold">術式別追加物品集計</h2>
      <p className="mt-2 text-sm text-ink-soft">
        搬送依頼時に登録された診療科・術式・物品情報をCSV出力します。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:max-w-xl">
        <label className="grid gap-1.5 text-sm font-medium">
          開始日
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 rounded border border-ink-line px-3 font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          終了日
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 rounded border border-ink-line px-3 font-normal"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-sm font-medium text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download size={16} aria-hidden />
        {isExporting ? "出力中..." : "術式別追加物品CSVエクスポート"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}