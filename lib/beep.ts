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

/**
 * Single tone with sine + octave overtone for richness, square sub-mix for
 * cut-through, and a short attack/release envelope.
 */
function tone(freq: number, duration: number, delay = 0): void {
  const c = getCtx();
  if (!c) return;
  const start = c.currentTime + delay;
  const stop = start + duration;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.85, start + 0.02);
  gain.gain.setValueAtTime(0.85, stop - 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);
  gain.connect(c.destination);

  // Body: sine
  const sine = c.createOscillator();
  sine.type = "sine";
  sine.frequency.value = freq;
  sine.connect(gain);
  sine.start(start);
  sine.stop(stop + 0.02);

  // Bite: square at half amplitude (mixed via its own gain)
  const sqGain = c.createGain();
  sqGain.gain.value = 0.35;
  sqGain.connect(gain);
  const sq = c.createOscillator();
  sq.type = "square";
  sq.frequency.value = freq;
  sq.connect(sqGain);
  sq.start(start);
  sq.stop(stop + 0.02);

  // Sparkle: octave-up sine
  const upGain = c.createGain();
  upGain.gain.value = 0.25;
  upGain.connect(gain);
  const up = c.createOscillator();
  up.type = "sine";
  up.frequency.value = freq * 2;
  up.connect(upGain);
  up.start(start);
  up.stop(stop + 0.02);
}

/**
 * Attention-grabbing alarm pattern.
 * 4 alternating tones (~1.6s total). Suitable for repeated playback.
 */
export function alarm(): void {
  tone(880, 0.22, 0);
  tone(1320, 0.22, 0.28);
  tone(880, 0.22, 0.56);
  tone(1320, 0.45, 0.84);
}
