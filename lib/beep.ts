/**
 * アラーム音の再生制御。
 *
 * - `unlockAudio()` で AudioContext をユーザー操作の文脈で起こす（モバイル制限対応）
 * - `startAlarm()` で `/sounds/dq_levelup_10s.wav` をループ再生開始
 * - `stopAlarm()` で停止
 *
 * 二重再生は内部でガード。stopAlarm 後の遅延 start は generation tokenで無効化する。
 */

const ALARM_SRC = "/sounds/dq_levelup_10s.wav";

let ctx: AudioContext | null = null;
let alarmBuffer: AudioBuffer | null = null;
let bufferLoadPromise: Promise<AudioBuffer | null> | null = null;
let activeSource: AudioBufferSourceNode | null = null;
let alarmGeneration = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudio(): boolean {
  const c = getCtx();
  if (!c) return false;
  if (c.state === "suspended") void c.resume();
  return c.state === "running" || c.state === "suspended";
}

async function ensureBuffer(): Promise<AudioBuffer | null> {
  if (alarmBuffer) return alarmBuffer;
  const c = getCtx();
  if (!c) return null;
  if (!bufferLoadPromise) {
    bufferLoadPromise = (async () => {
      try {
        const res = await fetch(ALARM_SRC);
        console.log("[alarm] loaded");
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const arr = await res.arrayBuffer();
        const buf = await c.decodeAudioData(arr);
        alarmBuffer = buf;
        return buf;
      } catch (e) {
        console.error("[alarm] load failed", e);
        bufferLoadPromise = null; // 次回再試行できるようにクリア
        return null;
      }
    })();
  }
  return bufferLoadPromise;
}

/**
 * アラームをループ再生で開始する。既に再生中なら何もしない。
 * 非同期だが呼び出し側は await しなくてよい。
 */
export async function startAlarm(): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (activeSource) return;

  const gen = ++alarmGeneration;
  const buf = await ensureBuffer();
  if (!buf) return;
  // 読み込み中に stopAlarm が呼ばれていたら無効化
  if (gen !== alarmGeneration) return;
  if (activeSource) return;

  // AudioContext が中断されていたら resume を試みる
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }

  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(c.destination);
  try {
    src.start();
    console.log("[alarm] started");
  } catch (e) {
    console.error("[alarm] start failed", e);
    return;
  }
  activeSource = src;
}

/** 再生中のアラームを停止。停止中なら何もしない。 */
export function stopAlarm(): void {
  alarmGeneration++; // 進行中の startAlarm を無効化
  if (!activeSource) return;
  try {
    activeSource.stop();
  } catch {
    /* ignore */
  }
  try {
    activeSource.disconnect();
  } catch {
    /* ignore */
  }
  activeSource = null;
}
