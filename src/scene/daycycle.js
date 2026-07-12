/* =========================================================
   一日の設計図：空の色・天体・生きものの時間窓
   （純粋ロジック。描画に依存しない）
   ========================================================= */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mix3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/* h: 時刻, top: 天頂, hz: 地平, amb: 環境光 0-1 */
const SKY_KEYS = [
  { h: 0.0,  top: hex("#070b22"), hz: hex("#131a38"), amb: 0.20 },
  { h: 3.6,  top: hex("#0c1130"), hz: hex("#242348"), amb: 0.24 },
  { h: 4.6,  top: hex("#232a56"), hz: hex("#8f5a63"), amb: 0.36 },
  { h: 5.4,  top: hex("#3c5a92"), hz: hex("#e89a5e"), amb: 0.58 },
  { h: 6.4,  top: hex("#5f93c6"), hz: hex("#f4d9a6"), amb: 0.82 },
  { h: 8.0,  top: hex("#5f9ed6"), hz: hex("#cfe6ef"), amb: 0.96 },
  { h: 12.0, top: hex("#4c92d8"), hz: hex("#d8edf5"), amb: 1.00 },
  { h: 15.5, top: hex("#5b99cf"), hz: hex("#e8ead9"), amb: 0.96 },
  { h: 17.2, top: hex("#6f90bd"), hz: hex("#f0c46e"), amb: 0.84 },
  { h: 18.4, top: hex("#4d4f80"), hz: hex("#ef8850"), amb: 0.60 },
  { h: 19.2, top: hex("#262a54"), hz: hex("#8a5a78"), amb: 0.40 },
  { h: 20.2, top: hex("#101637"), hz: hex("#293054"), amb: 0.26 },
  { h: 22.0, top: hex("#080d26"), hz: hex("#161d3c"), amb: 0.21 },
  { h: 24.0, top: hex("#070b22"), hz: hex("#131a38"), amb: 0.20 },
];

export function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 1 && SKY_KEYS[i + 1].h < h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[Math.min(i + 1, SKY_KEYS.length - 1)];
  const t = smooth(clamp((h - a.h) / ((b.h - a.h) || 1), 0, 1));
  return { top: mix3(a.top, b.top, t), hz: mix3(a.hz, b.hz, t), amb: lerp(a.amb, b.amb, t) };
}

export function sunAlt(h) { if (h < 5 || h > 19) return -0.2; return Math.sin(Math.PI * (h - 5) / 14); }
export function moonAlt(h) {
  let x = h; if (x < 12) x += 24;
  if (x < 19.5 || x > 28.5) return -0.2;
  return Math.sin(Math.PI * (x - 19.5) / 9);
}
export function nightFactor(h) { return clamp((0.5 - skyAt(h).amb) / 0.3, 0, 1); }

/* 天体の3D方向（カメラは -z を向く。太陽は南天を東→西へ） */
function arcDir(p, alt) {
  const a = Math.max(alt, -0.05) * Math.PI * 0.46;
  const phi = lerp(-1.25, 1.25, p);
  return [Math.sin(phi) * Math.cos(a), Math.sin(a), -Math.cos(phi) * Math.cos(a)];
}
export function sunDir(h) { return arcDir(clamp((h - 5) / 14, 0, 1), sunAlt(h)); }
export function moonDir(h) {
  let x = h; if (x < 12) x += 24;
  return arcDir(clamp((x - 19.5) / 9, 0, 1), moonAlt(h));
}
export function sunColor(h) {
  const low = clamp(1 - sunAlt(h) * 2.4, 0, 1);
  return mix3(hex("#fff0c4"), hex("#ff9450"), low);
}

/* 生きもの・気配の時間窓 */
export function morningBird(h) { return clamp(1 - Math.abs(h - 5.9) / 1.9, 0, 1); }
export function eveningBird(h) { return clamp(1 - Math.abs(h - 17.6) / 1.4, 0, 1); }
export function fireflyF(h)    { return clamp(1 - Math.abs(h - 20.8) / 2.2, 0, 1); }
export function frogF(h) {
  const d = Math.min(Math.abs(h - 20.5), Math.abs(h - 20.5 + 24), Math.abs(h - 20.5 - 24));
  return clamp(1 - d / 5.5, 0, 1);
}
export function cicadaF(h) { return clamp(1 - Math.abs(h - 13.2) / 4.2, 0, 1); }
export function cricketF(h) { return nightFactor(h); }
export function mistF(h) { return clamp(1 - Math.abs(h - 5.2) / 1.6, 0, 1); }

/* 再現性のある乱数 */
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
