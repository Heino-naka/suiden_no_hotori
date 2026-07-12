/* =========================================================
   水田のほとり v3 — エントリポイント
   固定視点＋ごく緩やかな揺れ。実時間／三分モード。
   ========================================================= */
import * as THREE from "three";
import {
  skyAt, sunAlt, moonAlt, nightFactor, sunDir, moonDir, sunColor,
  mistF, clamp, lerp,
} from "./scene/daycycle.js";
import { elapseDays } from "./state/growth.js";
import { loadState, saveState } from "./state/storage.js";
import { createSky } from "./scene/sky.js";
import { createWater } from "./scene/water.js";
import { createPaddy } from "./scene/paddy.js";
import { createRidge } from "./scene/ridge.js";
import { createCreatures } from "./scene/creatures.js";
import { createPost } from "./scene/postprocess.js";
import { initUI, whisper, updateHarvestBtn, updateGauge } from "./ui/controls.js";
import { updateAudio, frogCroak, plopSound } from "./audio/ambient.js";

/* ---------- 品質段階 ---------- */
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function pickTier() {
  const w = window.innerWidth, dpr = window.devicePixelRatio || 1;
  if (reduceMotion) return "low";
  if (w < 480) return "mid";
  if (w < 900 && dpr > 2) return "mid";
  return "high";
}
const tier = pickTier();

/* ---------- 状態と時間 ---------- */
const state = loadState();
{
  const days = (Date.now() - state.lastVisit) / 86400000;
  elapseDays(state, days);
  state.lastVisit = Date.now();
  saveState(state);
  if (days > 0.5) {
    const msgs = [`前に来てから、${days < 1.5 ? "一日" : Math.round(days) + "日"}。`];
    if (state.grass > 0.66) msgs.push("畔の草が伸びた。");
    else if (state.water < 0.3) msgs.push("水が減っている。");
    setTimeout(() => whisper(msgs.join("　")), 2600);
  }
}
let fastAnchorReal = 0, fastAnchorHour = 0;
function nowHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 + d.getMilliseconds() / 3600000;
}
function sceneHour() {
  if (state.mode === "fast") {
    const el = (performance.now() - fastAnchorReal) / 1000;
    return (fastAnchorHour + el * (24 / 180)) % 24;
  }
  return nowHour();
}
if (state.mode === "fast") { fastAnchorReal = performance.now(); fastAnchorHour = nowHour(); }

/* ---------- three.js 土台 ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: tier !== "low", powerPreference: "high-performance" });
} catch (e) {
  document.getElementById("whisper").textContent = "この端末では3D表示に対応していないようです。";
  document.getElementById("whisper").classList.add("show");
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
document.body.prepend(renderer.domElement);
renderer.domElement.id = "scene3d";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
const CAM_BASE = new THREE.Vector3(0, 1.55, 7.2);
const LOOK_BASE = new THREE.Vector3(0, 0.9, -20);
camera.position.copy(CAM_BASE);

/* ランバート系（畔・カエル）用の光 */
const sun = new THREE.DirectionalLight(0xffffff, 1);
const hemi = new THREE.HemisphereLight(0xbcd8ee, 0x3a3226, 0.6);
scene.add(sun, hemi);

/* 霧 */
scene.fog = new THREE.Fog(0xcfe0e8, 40, 200);

/* ---------- 山なみ ---------- */
function makeRidgeline(seedA, seedB, height, z, colorObj) {
  const shape = new THREE.Shape();
  shape.moveTo(-260, -10);
  for (let x = -260; x <= 260; x += 8) {
    const y = height * (0.5 + 0.32 * Math.sin(x * 0.011 + seedA) + 0.2 * Math.sin(x * 0.027 + seedB));
    shape.lineTo(x, y);
  }
  shape.lineTo(260, -10);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: colorObj, fog: true }));
  mesh.position.set(0, 0, z);
  return mesh;
}
const mtFar = makeRidgeline(1.4, 4.1, 22, -168, new THREE.Color(0x2a3a48));
const mtNear = makeRidgeline(4.2, 2.0, 13, -132, new THREE.Color(0x1a2a30));
scene.add(mtFar, mtNear);

/* ---------- 各レイヤー ---------- */
const sky = createSky(); scene.add(sky.mesh);
const water = createWater(); scene.add(water.mesh);
const paddy = createPaddy(tier); scene.add(paddy.group);
const ridge = createRidge(tier); scene.add(ridge.group);
const creatures = createCreatures(scene, tier, {
  onCroak: () => frogCroak(),
  onSplash: (x, z) => { water.addRipple(x, z, 1.0, perfTime()); plopSound(); },
});
const post = createPost(renderer, scene, camera, tier, reduceMotion);

/* ---------- 風 ---------- */
let gust = 0, gustTarget = 0, gustTimer = 0;
function windAt(t) {
  return clamp(0.34 + 0.20 * Math.sin(t * 0.11) + 0.12 * Math.sin(t * 0.043 + 2.1) + gust, 0.05, 1.25);
}
function updateWind(dt) {
  gustTimer -= dt;
  if (gustTimer <= 0) {
    gustTarget = Math.random() < 0.3 ? 0.45 + Math.random() * 0.5 : Math.random() * 0.12;
    gustTimer = 4 + Math.random() * 9;
  }
  gust += (gustTarget - gust) * Math.min(1, dt * 0.7);
}

/* ---------- リサイズ ---------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, tier === "high" ? 2 : 1.5);
  renderer.setSize(w, h);
  renderer.setPixelRatio(dpr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (post) post.setSize(w, h, dpr);
}
window.addEventListener("resize", resize);
resize();

/* ---------- タップ→波紋 ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function tapToWater(clientX, clientY, amp) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const dir = raycaster.ray.direction, org = raycaster.ray.origin;
  if (dir.y >= -0.001) return;
  const t = -org.y / dir.y;
  const x = org.x + dir.x * t, z = org.z + dir.z * t;
  if (z < 1.5 && z > -40 && Math.abs(x) < 40 && state.water > 0.12) {
    water.addRipple(x, z, amp, perfTime());
  }
}
let dragLast = 0;
renderer.domElement.addEventListener("pointerdown", (e) => tapToWater(e.clientX, e.clientY, 1.0));
renderer.domElement.addEventListener("pointermove", (e) => {
  if (e.buttons !== 1) return;
  const now = performance.now();
  if (now - dragLast < 90) return;
  dragLast = now;
  tapToWater(e.clientX, e.clientY, 0.45);
});

/* ---------- UI ---------- */
initUI(state, {
  onModeToggle: () => {
    if (state.mode === "real") {
      state.mode = "fast";
      fastAnchorReal = performance.now();
      fastAnchorHour = nowHour();
    } else state.mode = "real";
  },
  onFertilize: () => {
    for (let i = 0; i < 5; i++) {
      water.addRipple((Math.random() - 0.5) * 20, -3 - Math.random() * 12, 0.6, perfTime());
    }
  },
  onWaterAdjust: () => {
    for (let i = 0; i < 4; i++) {
      water.addRipple((Math.random() - 0.5) * 24, -2 - Math.random() * 16, 0.7, perfTime());
    }
  },
});

/* ---------- 主ループ ---------- */
let lastT = 0, lastSave = 0, running = true, startT = performance.now();
function perfTime() { return (performance.now() - startT) / 1000; }
document.addEventListener("visibilitychange", () => {
  running = !document.hidden;
  if (running) {
    lastT = performance.now();
    const gap = (Date.now() - state.lastVisit) / 86400000;
    if (gap > 0) {
      elapseDays(state, gap);
      state.lastVisit = Date.now(); saveState(state);
      updateHarvestBtn(state); updateGauge(state);
    }
  } else { state.lastVisit = Date.now(); saveState(state); }
});

const env = {
  h: 12, time: 0, wind: 0.3, amb: 1, night: 0,
  top: [0, 0, 0], hz: [0, 0, 0],
  sunD: [0, 1, 0], sunC: [1, 1, 1], sunI: 0,
  moonD: [0, 1, 0], moonI: 0,
  fogC: [0.8, 0.85, 0.9], fogNear: 40, fogFar: 200,
  camPos: camera.position, state, reduceMotion,
};

function frame(nowMs) {
  requestAnimationFrame(frame);
  if (!running) return;
  const dt = Math.min(0.05, (nowMs - lastT) / 1000 || 0.016);
  lastT = nowMs;
  const time = perfTime();
  const h = sceneHour();

  /* 生育（常に実時間） */
  const wasGrown = state.growth >= 1;
  elapseDays(state, dt / 86400);
  if (!wasGrown && state.growth >= 1) { whisper("稲穂が、実った。", 6000); updateHarvestBtn(state); }
  if (nowMs - lastSave > 30000) { state.lastVisit = Date.now(); saveState(state); lastSave = nowMs; }

  updateWind(dt);
  const wind = windAt(time);

  /* 環境パラメータ */
  const s = skyAt(h);
  env.h = h; env.time = time; env.wind = wind;
  env.amb = s.amb; env.night = nightFactor(h);
  env.top = s.top; env.hz = s.hz;
  env.sunD = sunDir(h); env.sunC = sunColor(h);
  env.sunI = clamp(sunAlt(h) * 4, 0, 1) * (sunAlt(h) > 0 ? 1 : 0);
  if (sunAlt(h) > -0.02) env.sunI = Math.max(env.sunI, 0.12);
  env.moonD = moonDir(h);
  env.moonI = moonAlt(h) > 0 ? nightFactor(h) : 0;

  /* 霧：地平の色を借り、朝もやで濃くなる */
  const mist = mistF(h);
  const fogMix = 0.55 + 0.25 * mist;
  env.fogC = [
    lerp(s.top[0], s.hz[0], fogMix),
    lerp(s.top[1], s.hz[1], fogMix),
    lerp(s.top[2], s.hz[2], fogMix),
  ];
  env.fogNear = lerp(42, 14, mist);
  env.fogFar = lerp(230, 110, mist);
  scene.fog.color.setRGB(env.fogC[0], env.fogC[1], env.fogC[2]);
  scene.fog.near = env.fogNear;
  scene.fog.far = env.fogFar;

  /* ライト（ランバート系用） */
  sun.position.set(env.sunD[0] * 50, Math.max(env.sunD[1], 0.05) * 50, env.sunD[2] * 50);
  sun.color.setRGB(env.sunC[0], env.sunC[1], env.sunC[2]);
  sun.intensity = env.sunI * 1.4 + env.moonI * 0.12;
  hemi.intensity = 0.15 + s.amb * 0.55;
  hemi.color.setRGB(s.top[0] * 0.6 + 0.35, s.top[1] * 0.6 + 0.38, s.top[2] * 0.6 + 0.42);
  hemi.groundColor.setRGB(0.23 * s.amb + 0.05, 0.2 * s.amb + 0.045, 0.15 * s.amb + 0.04);

  /* 山なみの色（空となじませる） */
  mtFar.material.color.setRGB(
    lerp(s.hz[0], 0.16, 0.62), lerp(s.hz[1], 0.23, 0.62), lerp(s.hz[2], 0.28, 0.62));
  mtNear.material.color.setRGB(
    lerp(s.hz[0], 0.10, 0.78), lerp(s.hz[1], 0.16, 0.78), lerp(s.hz[2], 0.19, 0.78));

  /* カメラ：ごく緩やかな揺れ */
  if (!reduceMotion) {
    camera.position.set(
      CAM_BASE.x + Math.sin(time * 0.05) * 0.35,
      CAM_BASE.y + Math.sin(time * 0.073) * 0.06,
      CAM_BASE.z + Math.sin(time * 0.031) * 0.2,
    );
  }
  camera.lookAt(
    LOOK_BASE.x + Math.sin(time * 0.041) * 0.8,
    LOOK_BASE.y,
    LOOK_BASE.z,
  );

  /* 各レイヤー更新 */
  sky.update(env);
  water.update(env);
  paddy.update(env);
  ridge.update(env);
  creatures.update(env, dt);
  updateAudio(dt, h, wind);

  if (post) { post.update(time); post.render(); }
  else renderer.render(scene, camera);
}
requestAnimationFrame((t) => { lastT = t; frame(t); });
