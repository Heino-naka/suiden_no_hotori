import { skyAt, sunAlt, moonAlt, nightFactor, fireflyF, frogF, cicadaF, sunDir, moonDir } from "../src/scene/daycycle.js";
import { elapseDays, plantBodyColor, earColor } from "../src/state/growth.js";
import { defaultState } from "../src/state/storage.js";

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.log("  ✗ " + n); } };

/* 空 */
for (let h = 0; h <= 24; h += 0.05) {
  const s = skyAt(h);
  ok(s.top.every((v) => v >= 0 && v <= 1), "top range @" + h.toFixed(2));
  ok(s.hz.every((v) => v >= 0 && v <= 1), "hz range @" + h.toFixed(2));
  ok(s.amb >= 0.15 && s.amb <= 1.001, "amb @" + h.toFixed(2));
}
const d3 = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
for (const kh of [3.6, 4.6, 5.4, 6.4, 8, 12, 15.5, 17.2, 18.4, 19.2, 20.2, 22]) {
  ok(d3(skyAt(kh - 0.001).top, skyAt(kh + 0.001).top) < 0.02, "continuous top @" + kh);
  ok(d3(skyAt(kh - 0.001).hz, skyAt(kh + 0.001).hz) < 0.02, "continuous hz @" + kh);
}
ok(d3(skyAt(0).top, skyAt(24).top) < 1e-9, "wraps");
ok(skyAt(12).amb === 1, "noon amb");
ok(nightFactor(1) > 0.9 && nightFactor(12) === 0, "night factor");

/* 天体 */
ok(sunAlt(12) > 0.95 && sunAlt(3) < 0, "sun alt");
ok(moonAlt(0) > 0.9 && moonAlt(12) < 0, "moon alt");
const len = (v) => Math.hypot(v[0], v[1], v[2]);
for (let h = 0; h < 24; h += 0.5) {
  ok(Math.abs(len(sunDir(h)) - 1) < 1e-6, "sunDir unit @" + h);
  ok(Math.abs(len(moonDir(h)) - 1) < 1e-6, "moonDir unit @" + h);
}
ok(sunDir(12)[2] < 0 && sunDir(12)[1] > 0.9, "sun front & high at noon");

/* 生きもの窓 */
ok(frogF(20.5) > 0.95 && frogF(12) < 0.05, "frog window");
ok(fireflyF(20.8) > 0.95 && fireflyF(10) === 0, "firefly window");
ok(cicadaF(13.2) > 0.95 && cicadaF(22) === 0, "cicada window");

/* 生育 */
{
  let s = defaultState(); s.vigor = 0; s.water = 0.08;
  for (let d = 0; d < 40; d++) elapseDays(s, 1);
  ok(s.growth >= 1, "neglect ripens");
  ok(s.water >= 0.08 && s.grass === 1, "floors");
}
{
  let a = defaultState(); a.vigor = 0; a.water = 0.08;
  let b = defaultState(); b.water = 0.55;
  let da = 0, db = 0;
  while (a.growth < 1 && da < 60) { elapseDays(a, 0.25); da += 0.25; }
  while (b.growth < 1 && db < 60) { b.vigor = Math.max(b.vigor, 0.8); b.water = 0.55; elapseDays(b, 0.25); db += 0.25; }
  ok(db < da - 2 && db > 7, `care faster (${db.toFixed(1)}d vs ${da.toFixed(1)}d)`);
}
{
  let s = defaultState();
  for (let i = 0; i < 100000; i++) elapseDays(s, 0.016 / 86400);
  ok(s.growth > 0 && s.growth < 0.02 && !Number.isNaN(s.growth), "frame elapse sane");
}
{
  let s = defaultState(); const g0 = s.growth;
  elapseDays(s, 0); elapseDays(s, -5);
  ok(s.growth === g0, "no-op elapse");
}

/* 色 */
for (let g = 0; g <= 1.0001; g += 0.01) {
  const gg = Math.min(g, 1);
  ok(plantBodyColor(gg).every((v) => v >= 0 && v <= 1), "plant color @" + gg.toFixed(2));
  ok(earColor(gg).every((v) => v >= 0 && v <= 1), "ear color @" + gg.toFixed(2));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
