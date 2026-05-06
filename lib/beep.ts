let ctx: AudioContext | null = null;

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

function tone(freq: number, duration: number, delay = 0): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const start = c.currentTime + delay;
  const stop = start + duration;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(stop + 0.02);
}

export function alarm(): void {
  tone(880, 0.18, 0);
  tone(1175, 0.18, 0.22);
  tone(880, 0.28, 0.44);
}
