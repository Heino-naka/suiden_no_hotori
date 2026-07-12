/* =========================================================
   生きもの：鳥・トンボ・蛍・カエル・魚の跳ね
   出現ロジックはv1/v2の時間窓を踏襲。
   ========================================================= */
import * as THREE from "three";
import { morningBird, eveningBird, fireflyF, frogF, clamp, lerp } from "./daycycle.js";

/* ---------- 鳥 ---------- */
function makeBird() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x1e242c, side: THREE.DoubleSide, fog: true });
  const wingGeo = new THREE.PlaneGeometry(0.9, 0.28);
  wingGeo.translate(0.45, 0, 0);
  const L = new THREE.Mesh(wingGeo, mat); L.rotation.y = Math.PI;
  const R = new THREE.Mesh(wingGeo, mat);
  g.add(L); g.add(R);
  g.userData = { L, R, ph: Math.random() * 6.28 };
  return g;
}

/* ---------- カエル ---------- */
function makeFrog() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x608c40 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat);
  body.scale.set(1.35, 0.8, 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), mat);
  head.position.set(0.055, 0.02, 0);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd2d6b4 }));
  throat.position.set(0.06, -0.005, 0);
  throat.scale.setScalar(0.01);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e2818 });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), eyeMat);
  e1.position.set(0.07, 0.045, 0.018);
  const e2 = e1.clone(); e2.position.z = -0.018;
  g.add(body, head, throat, e1, e2);
  g.userData = { throat, hop: 0, nextHop: 3 + Math.random() * 14, croakAt: 1 + Math.random() * 8, dir: Math.random() < 0.5 ? -1 : 1, baseY: 0 };
  return g;
}

/* ---------- トンボ ---------- */
function makeDragonfly() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x466e8c });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.007, 0.09, 5), bodyMat);
  body.rotation.z = Math.PI / 2;
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xdce6f0, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const wGeo = new THREE.PlaneGeometry(0.07, 0.014);
  wGeo.translate(0.035, 0, 0);
  const w1 = new THREE.Mesh(wGeo, wingMat); w1.position.set(0.01, 0.008, 0); w1.rotation.z = 0.5;
  const w2 = w1.clone(); w2.rotation.z = 2.6;
  g.add(body, w1, w2);
  g.userData = { bodyMat, tx: 0, ty: 0, tz: 0, t: 0, ph: Math.random() * 6.28 };
  return g;
}

export function createCreatures(scene, tier, hooks) {
  const group = new THREE.Group();
  scene.add(group);

  const birds = [];
  const frogs = [];
  const dragonflies = [];
  let splashEvent = null;
  let nextSplash = 25;

  /* ---------- 蛍（Points） ---------- */
  const FN = tier === "low" ? 24 : 46;
  const fPos = new Float32Array(FN * 3);
  const fPh = new Float32Array(FN);
  const rnd = () => Math.random();
  for (let i = 0; i < FN; i++) {
    fPos[i * 3] = (rnd() - 0.5) * 30;
    fPos[i * 3 + 1] = 0.3 + rnd() * 1.6;
    fPos[i * 3 + 2] = -2 - rnd() * 16;
    fPh[i] = rnd() * 6.28;
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  fGeo.setAttribute("aPh", new THREE.BufferAttribute(fPh, 1));
  const fUniforms = { uTime: { value: 0 }, uF: { value: 0 } };
  const fMat = new THREE.ShaderMaterial({
    uniforms: fUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPh;
      uniform float uTime;
      varying float vB;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.35 + aPh) * 1.2;
        p.y += sin(uTime * 0.22 + aPh * 2.0) * 0.35;
        p.z += cos(uTime * 0.28 + aPh) * 1.0;
        float blink = max(0.0, sin(uTime * (1.1 + fract(aPh) * 0.9) + aPh * 7.0));
        vB = blink * blink;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (26.0 * vB + 4.0) / max(-mv.z, 1.0) * 8.0;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vB;
      uniform float uF;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d) * vB * uF;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.84, 0.93, 0.51, a);
      }
    `,
  });
  const fireflies = new THREE.Points(fGeo, fMat);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  /* ---------- 魚のしぶき ---------- */
  const SPN = 14;
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPN * 3), 3));
  const spMat = new THREE.PointsMaterial({ color: 0xdfeef2, size: 0.035, transparent: true, opacity: 0, depthWrite: false });
  const spray = new THREE.Points(spGeo, spMat);
  spray.frustumCulled = false;
  group.add(spray);
  const spVel = [];
  for (let i = 0; i < SPN; i++) spVel.push(new THREE.Vector3());

  function triggerSplash(x, z, time) {
    splashEvent = { x, z, t0: time };
    const p = spGeo.attributes.position;
    for (let i = 0; i < SPN; i++) {
      p.setXYZ(i, x, 0.02, z);
      spVel[i].set((Math.random() - 0.5) * 1.2, 1.0 + Math.random() * 1.4, (Math.random() - 0.5) * 1.2);
    }
    p.needsUpdate = true;
    hooks.onSplash(x, z);
  }

  function update(env, dt) {
    const h = env.h, time = env.time;

    /* 鳥 */
    if (Math.random() < (morningBird(h) * 0.14 + eveningBird(h) * 0.1) * dt && birds.length < 2) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const flock = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const b = makeBird();
        b.position.set(-i * 1.6 * dir + (Math.random() - 0.5), (i % 2 ? 1 : -1) * i * 0.4, (Math.random() - 0.5) * 2);
        flock.add(b);
      }
      flock.position.set(dir > 0 ? -70 : 70, 22 + Math.random() * 14, -50 - Math.random() * 30);
      flock.userData = { v: (5 + Math.random() * 3) * dir };
      group.add(flock);
      birds.push(flock);
    }
    for (let i = birds.length - 1; i >= 0; i--) {
      const fl = birds[i];
      fl.position.x += fl.userData.v * dt;
      fl.children.forEach((b) => {
        const flap = Math.sin(time * 9 + b.userData.ph) * 0.7;
        b.userData.L.rotation.x = flap;
        b.userData.R.rotation.x = -flap;
      });
      if (Math.abs(fl.position.x) > 90) { group.remove(fl); birds.splice(i, 1); }
    }

    /* カエル */
    const wantFrogs = frogF(h) > 0.25 ? 3 : 0;
    while (frogs.length < wantFrogs) {
      const f = makeFrog();
      f.position.set((Math.random() - 0.5) * 14, 0.32, 3.0 + Math.random() * 2.2);
      f.userData.baseY = f.position.y;
      f.rotation.y = Math.random() * Math.PI * 2;
      group.add(f); frogs.push(f);
    }
    while (frogs.length > wantFrogs) { group.remove(frogs.pop()); }
    for (const f of frogs) {
      const u = f.userData;
      u.nextHop -= dt; u.croakAt -= dt;
      if (u.hop > 0) {
        u.hop += dt * 2.2;
        f.position.y = u.baseY + Math.sin(Math.min(u.hop, 1) * Math.PI) * 0.14;
        f.translateX(dt * 0.4);
        if (u.hop >= 1) { u.hop = 0; f.position.y = u.baseY; }
      } else if (u.nextHop <= 0) {
        u.hop = 0.01; u.nextHop = 4 + Math.random() * 16;
        if (Math.random() < 0.3) f.rotation.y += (Math.random() - 0.5) * 2;
      }
      if (u.croakAt <= 0) { u.throatT = 1; u.croakAt = 3 + Math.random() * 10; hooks.onCroak(); }
      if (u.throatT > 0) {
        u.throatT -= dt * 2.4;
        const s = Math.max(u.throatT, 0.01);
        u.throat.scale.setScalar(s);
      }
    }

    /* トンボ */
    const wantDf = (h > 8.5 && h < 17.5) ? (tier === "low" ? 1 : 2) : 0;
    while (dragonflies.length < wantDf) {
      const d = makeDragonfly();
      d.position.set((Math.random() - 0.5) * 16, 0.4 + Math.random() * 0.8, -2 - Math.random() * 8);
      group.add(d); dragonflies.push(d);
    }
    while (dragonflies.length > wantDf) { group.remove(dragonflies.pop()); }
    for (const d of dragonflies) {
      const u = d.userData;
      u.t -= dt;
      if (u.t <= 0) {
        u.tx = d.position.x + (Math.random() - 0.5) * 6;
        u.ty = clamp(d.position.y + (Math.random() - 0.5) * 0.6, 0.25, 1.6);
        u.tz = clamp(d.position.z + (Math.random() - 0.5) * 5, -14, -1);
        u.t = 1.5 + Math.random() * 3;
      }
      d.position.x += (u.tx - d.position.x) * dt * 2.2;
      d.position.y += (u.ty - d.position.y) * dt * 2.2 + Math.sin(time * 9 + u.ph) * 0.004;
      d.position.z += (u.tz - d.position.z) * dt * 2.2;
      u.bodyMat.color.setHex(env.state.growth > 0.72 ? 0xc44632 : 0x466e8c);
    }

    /* 蛍 */
    fUniforms.uTime.value = time;
    fUniforms.uF.value = fireflyF(h) * (env.reduceMotion ? 0.5 : 1);

    /* 魚の跳ね */
    if (!splashEvent) {
      nextSplash -= dt;
      if (nextSplash <= 0 && h > 5 && h < 20 && env.state.water > 0.3) {
        nextSplash = 25 + Math.random() * 55;
        triggerSplash((Math.random() - 0.5) * 20, -3 - Math.random() * 14, time);
      }
      spMat.opacity = Math.max(0, spMat.opacity - dt * 2);
    } else {
      const age = time - splashEvent.t0;
      spMat.opacity = clamp(1 - age, 0, 0.9);
      const p = spGeo.attributes.position;
      for (let i = 0; i < SPN; i++) {
        spVel[i].y -= 4.5 * dt;
        p.setXYZ(i, p.getX(i) + spVel[i].x * dt, Math.max(p.getY(i) + spVel[i].y * dt, 0.0), p.getZ(i) + spVel[i].z * dt);
      }
      p.needsUpdate = true;
      if (age > 1.1) splashEvent = null;
    }
  }
  return { update };
}
