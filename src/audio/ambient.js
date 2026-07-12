/* =========================================================
   環境音：Web Audio による合成のみ。音源ファイルなし。
   ========================================================= */
import { frogF, morningBird, eveningBird, cicadaF, cricketF } from "../scene/daycycle.js";

let AC = null, master = null, ready = false;
const layers = {};
let soundOn = true;

function noiseBuffer(sec) {
  const b = AC.createBuffer(1, AC.sampleRate * sec, AC.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

export function initAudio(initialOn) {
  if (ready) return;
  soundOn = initialOn;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
    const noise = noiseBuffer(2);
    { /* 風 */
      const src = AC.createBufferSource(); src.buffer = noise; src.loop = true;
      const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520; lp.Q.value = 0.4;
      const g = AC.createGain(); g.gain.value = 0;
      src.connect(lp).connect(g).connect(master); src.start();
      layers.wind = { g, lp };
    }
    { /* 水 */
      const src = AC.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.35;
      const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180;
      const g = AC.createGain(); g.gain.value = 0.015;
      src.connect(lp).connect(g).connect(master); src.start();
      layers.water = { g };
    }
    { /* 蝉 */
      const src = AC.createBufferSource(); src.buffer = noise; src.loop = true;
      const bp = AC.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 5200; bp.Q.value = 9;
      const g = AC.createGain(); g.gain.value = 0;
      const lfo = AC.createOscillator(); lfo.frequency.value = 42;
      const lg = AC.createGain(); lg.gain.value = 0.5;
      const dc = AC.createConstantSource(); dc.offset.value = 0.5;
      const mod = AC.createGain(); mod.gain.value = 0;
      lfo.connect(lg).connect(mod.gain); dc.connect(mod.gain);
      src.connect(bp).connect(mod).connect(g).connect(master);
      lfo.start(); dc.start(); src.start();
      layers.cicada = { g };
    }
    ready = true;
    master.gain.setTargetAtTime(soundOn ? 0.9 : 0, AC.currentTime, 0.8);
  } catch (e) { ready = false; }
}
export function resumeAudio() { if (AC && AC.state === "suspended") AC.resume(); }
export function setSound(on) {
  soundOn = on;
  if (ready) master.gain.setTargetAtTime(on ? 0.9 : 0, AC.currentTime, 0.5);
}

export function frogCroak() {
  if (!ready || !soundOn) return;
  const t0 = AC.currentTime;
  const n = 2 + Math.floor(Math.random() * 3);
  const pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(master); }
  for (let i = 0; i < n; i++) {
    const t = t0 + i * 0.16;
    const o = AC.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(130 + Math.random() * 30, t);
    o.frequency.exponentialRampToValueAtTime(82, t + 0.11);
    const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 680;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    o.connect(lp).connect(g).connect(pan || master);
    o.start(t); o.stop(t + 0.16);
  }
}
export function birdChirp() {
  if (!ready || !soundOn) return;
  const t0 = AC.currentTime;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * (0.09 + Math.random() * 0.07);
    const o = AC.createOscillator(); o.type = "sine";
    const f0 = 2400 + Math.random() * 1400;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * (1.25 + Math.random() * 0.5), t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.9, t + 0.09);
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.022, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.12);
  }
}
export function cricketChirp() {
  if (!ready || !soundOn) return;
  const t0 = AC.currentTime;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.055;
    const o = AC.createOscillator(); o.type = "sine"; o.frequency.value = 4300 + Math.random() * 300;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.012, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
  }
}
export function splashSound() {
  if (!ready || !soundOn) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource(); src.buffer = noiseBuffer(0.3);
  const bp = AC.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  src.connect(bp).connect(g).connect(master); src.start(t);
}
export function plopSound() {
  if (!ready || !soundOn) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(); o.type = "sine";
  o.frequency.setValueAtTime(520, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.2);
}

let nf = 0, nb = 0, nc = 0;
export function updateAudio(dt, h, wind) {
  if (!ready) return;
  const t = AC.currentTime;
  layers.wind.g.gain.setTargetAtTime(0.06 * wind, t, 0.6);
  layers.wind.lp.frequency.setTargetAtTime(320 + wind * 520, t, 0.6);
  layers.cicada.g.gain.setTargetAtTime(0.028 * cicadaF(h), t, 1.2);
  nf -= dt; nb -= dt; nc -= dt;
  const ff = frogF(h);
  if (ff > 0.15 && nf <= 0) { frogCroak(); nf = (1.2 + Math.random() * 4) / Math.max(ff, 0.2); }
  const bf = morningBird(h) + eveningBird(h) * 0.6;
  if (bf > 0.1 && nb <= 0) { birdChirp(); nb = (1 + Math.random() * 3.5) / Math.max(bf, 0.2); }
  const cf = cricketF(h);
  if (cf > 0.2 && nc <= 0) { cricketChirp(); nc = (0.6 + Math.random() * 1.8) / Math.max(cf, 0.3); }
}
