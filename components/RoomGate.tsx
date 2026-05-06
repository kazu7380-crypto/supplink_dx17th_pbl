"use client";

import { useState } from "react";
import { useRoom } from "./providers";
import { ROOMS } from "@/lib/types";

export function RoomGate({ children }: { children: React.ReactNode }) {
  const { room, ready, setRoom } = useRoom();
  const [draft, setDraft] = useState("");

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-muted">
        読み込み中...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <img
          src="/sapurink_image.png"
          alt="サプリンク"
          className="mb-6 h-64 w-auto"
        />
        <div className="w-full max-w-md rounded-lg border border-ink-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">手術室を選択してください</h2>
          <p className="mt-1 text-sm text-ink-muted">
            このブラウザの間、ご依頼は選択した手術室として送信されます。
          </p>
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="mt-4 w-full rounded border border-ink-line bg-white px-3 py-2 text-sm"
          >
            <option value="">部屋を選択</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!draft}
            onClick={() => setRoom(draft)}
            className="mt-4 w-full rounded bg-ink px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            この手術室で開始
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
