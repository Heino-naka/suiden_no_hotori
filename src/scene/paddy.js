/* =========================================================
   稲：一株＝6枚の葉のロゼットをジオメトリに焼き、
   InstancedMesh で数千株を一括描画。
   風は頂点シェーダーで場を渡る波としてなびかせる。
   穂は別インスタンスで、成長に応じて現れ、垂れる。
   ========================================================= */
import * as THREE from "three";
import { mulberry, lerp, smooth } from "./daycycle.js";
import { plantBodyColor, earColor } from "../state/growth.js";

const BLADES = 6, SEGS = 5;

/* 一株ぶんの葉ロゼット（単位高さ1、シェーダーで伸縮） */
function buildPlantGeometry(seed) {
  const rand = mulberry(seed);
  const pos = [], hf = [], side = [], bph = [], idx = [];
  let vi = 0;
  for (let b = 0; b < BLADES; b++) {
    const ang = (b / BLADES) * Math.PI * 2 + rand() * 0.8;
    const lean = 0.12 + rand() * 0.3;              /* 外側への開き */
    const len = 0.82 + rand() * 0.35;
    const w0 = 0.016 + rand() * 0.008;
    const phase = rand() * Math.PI * 2;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    for (let s = 0; s <= SEGS; s++) {
      const t = s / SEGS;
      const y = t * len;
      const out = lean * t * t * len;              /* 先端ほど外へ倒れる */
      const w = w0 * (1 - t * 0.92);
      const px = dx * out, pz = dz * out;
      /* 幅方向は葉の向きに直交 */
      const nx = -dz, nz = dx;
      pos.push(px + nx * w, y, pz + nz * w);
      pos.push(px - nx * w, y, pz - nz * w);
      hf.push(t, t); side.push(1, -1); bph.push(phase, phase);
      if (s < SEGS) {
        const a = vi, b2 = vi + 1, c = vi + 2, d = vi + 3;
        idx.push(a, b2, c, b2, d, c);
        vi += 2;
      } else vi += 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aHf", new THREE.Float32BufferAttribute(hf, 1));
  g.setAttribute("aBph", new THREE.Float32BufferAttribute(bph, 1));
  g.setIndex(idx);
  return g;
}

/* 穂：垂れる弧のリボン。籾の凹凸は縁の波で示す */
function buildEarGeometry() {
  const pos = [], hf = [], idx = [];
  const SEG = 9;
  let vi = 0;
  for (let s = 0; s <= SEG; s++) {
    const t = s / SEG;
    const w = 0.013 * (1 - t * 0.3) * (1 + 0.55 * Math.sin(t * 26.0)); /* 籾の粒感 */
    pos.push(-w, t, 0, w, t, 0);
    hf.push(t, t);
    if (s < SEG) { idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2); }
    vi += 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aHf", new THREE.Float32BufferAttribute(hf, 1));
  g.setIndex(idx);
  return g;
}

const PLANT_VERT = /* glsl */ `
  attribute float aHf;      /* 0=根元 1=先端 */
  attribute float aBph;     /* 葉ごとの位相 */
  attribute float aPhase;   /* 株ごとの位相 */
  attribute float aScale;   /* 株ごとの大きさゆらぎ */
  uniform float uTime, uWind, uHeight, uDroop;
  varying float vHf;
  varying vec3 vN;
  varying vec3 vWorld;
  void main(){
    vHf = aHf;
    vec3 p = position;
    p.y *= uHeight * aScale;
    p.xz *= (0.7 + 0.3 * aScale);
    vec4 wp = instanceMatrix * vec4(p, 1.0);
    /* 田面を渡る風の波 */
    float gustPhase = uTime * 1.9 - wp.x * 0.35 - wp.z * 0.22 + aPhase;
    float sway = uWind * (0.5 + 0.5 * sin(gustPhase)) ;
    float bladeSway = 0.35 * sin(uTime * 2.6 + aBph + aPhase);
    float bend = (sway + bladeSway * uWind) * aHf * aHf;
    wp.x += bend * 0.28;
    wp.z += bend * 0.10;
    /* 実るほど頭を垂れる */
    wp.x += uDroop * aHf * aHf * 0.10;
    wp.y -= uDroop * aHf * aHf * 0.05;
    vWorld = wp.xyz;
    vN = normalize(vec3(bend * -0.6, 1.0, 0.2));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const PLANT_FRAG = /* glsl */ `
  varying float vHf;
  varying vec3 vN;
  varying vec3 vWorld;
  uniform vec3 uColBase, uColTip, uSunD, uSunC, uFogC, uCamPos;
  uniform float uSunI, uAmb, uFogNear, uFogFar, uRim;
  void main(){
    vec3 base = mix(uColBase, uColTip, vHf);
    vec3 n = normalize(vN);
    float diff = max(dot(n, uSunD), 0.0) * uSunI;
    float back = max(dot(n, -uSunD), 0.0) * uSunI * 0.35;   /* 透過光 */
    vec3 col = base * (0.28 + uAmb * 0.55 + diff * 0.55 + back * 0.4);
    /* 朝夕の縁光 */
    vec3 V = normalize(uCamPos - vWorld);
    float rim = pow(1.0 - max(dot(n, V), 0.0), 2.2) * uRim;
    col += uSunC * rim * 0.5;
    float fogT = smoothstep(uFogNear, uFogFar, length(vWorld - uCamPos));
    col = mix(col, uFogC, fogT);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createPaddy(tier) {
  const step = tier === "high" ? 0.62 : tier === "mid" ? 0.8 : 1.05;
  const positions = [];
  const rand = mulberry(20260711);
  for (let z = -3.2; z > -34; z -= step * 1.15) {
    for (let x = -24; x < 24; x += step) {
      positions.push([x + (rand() - 0.5) * step * 0.5, z + (rand() - 0.5) * step * 0.4]);
    }
  }
  const N = positions.length;

  const sharedUniforms = {
    uTime: { value: 0 }, uWind: { value: 0.3 },
    uHeight: { value: 0.3 }, uDroop: { value: 0 },
    uColBase: { value: new THREE.Vector3() }, uColTip: { value: new THREE.Vector3() },
    uSunD: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Vector3(1, 1, 1) },
    uSunI: { value: 0 }, uAmb: { value: 1 }, uRim: { value: 0 },
    uFogC: { value: new THREE.Vector3() }, uFogNear: { value: 30 }, uFogFar: { value: 180 },
    uCamPos: { value: new THREE.Vector3() },
  };
  const plantMat = new THREE.ShaderMaterial({
    uniforms: sharedUniforms, vertexShader: PLANT_VERT, fragmentShader: PLANT_FRAG,
    side: THREE.DoubleSide, fog: false,
  });

  const geo = buildPlantGeometry(42);
  const mesh = new THREE.InstancedMesh(geo, plantMat, N);
  const dummy = new THREE.Object3D();
  const aPhase = new Float32Array(N), aScale = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [x, z] = positions[i];
    dummy.position.set(x, -0.02, z);
    dummy.rotation.y = rand() * Math.PI * 2;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    aPhase[i] = rand() * Math.PI * 2;
    aScale[i] = 0.8 + rand() * 0.4;
  }
  geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
  geo.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;

  /* --- 穂 --- */
  const earUniforms = {
    uTime: sharedUniforms.uTime, uWind: sharedUniforms.uWind,
    uPlantH: { value: 0.3 }, uEarAmt: { value: 0 },
    uEarC: { value: new THREE.Vector3() },
    uSunD: sharedUniforms.uSunD, uSunI: sharedUniforms.uSunI, uAmb: sharedUniforms.uAmb,
    uFogC: sharedUniforms.uFogC, uFogNear: sharedUniforms.uFogNear, uFogFar: sharedUniforms.uFogFar,
    uCamPos: sharedUniforms.uCamPos,
  };
  const earMat = new THREE.ShaderMaterial({
    uniforms: earUniforms, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `
      attribute float aHf;
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime, uWind, uPlantH, uEarAmt;
      varying float vHf;
      varying vec3 vWorld;
      void main(){
        vHf = aHf;
        vec3 p = position;
        float L = 0.16 * uEarAmt * aScale;           /* 穂の長さ */
        float droop = uEarAmt * uEarAmt;
        /* 弧を描いて垂れる */
        float ang = aHf * (0.7 + droop * 1.5);
        vec3 arc = vec3(sin(ang) * L, (cos(ang) - 0.0) * L, 0.0);
        p = vec3(p.x, 0.0, 0.0) + arc;
        p.y += uPlantH * aScale;                     /* 株の先端に付く */
        vec4 wp = instanceMatrix * vec4(p, 1.0);
        float gustPhase = uTime * 1.9 - wp.x * 0.35 - wp.z * 0.22 + aPhase;
        float sway = uWind * (0.5 + 0.5 * sin(gustPhase));
        wp.x += sway * 0.30;
        wp.z += sway * 0.11;
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vHf;
      varying vec3 vWorld;
      uniform vec3 uEarC, uSunD, uFogC, uCamPos;
      uniform float uSunI, uAmb, uFogNear, uFogFar;
      void main(){
        vec3 col = uEarC * (0.32 + uAmb * 0.62 + uSunI * 0.45);
        col *= 0.92 + 0.16 * sin(vHf * 26.0);        /* 籾の陰影 */
        float fogT = smoothstep(uFogNear, uFogFar, length(vWorld - uCamPos));
        col = mix(col, uFogC, fogT);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const earGeo = buildEarGeometry();
  const ears = new THREE.InstancedMesh(earGeo, earMat, N);
  for (let i = 0; i < N; i++) {
    mesh.getMatrixAt(i, dummy.matrix);
    ears.setMatrixAt(i, dummy.matrix);
  }
  earGeo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
  earGeo.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
  ears.instanceMatrix.needsUpdate = true;
  ears.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh); group.add(ears);

  function update(env) {
    const g = env.state.growth;
    sharedUniforms.uTime.value = env.time;
    sharedUniforms.uWind.value = env.wind * (env.reduceMotion ? 0.35 : 1);
    sharedUniforms.uHeight.value = lerp(0.16, 0.92, smooth(g)) * (1 + env.state.vigor * 0.06);
    sharedUniforms.uDroop.value = smooth(Math.max(0, (g - 0.7) / 0.3));
    const body = plantBodyColor(g);
    sharedUniforms.uColBase.value.set(body[0] * 0.55, body[1] * 0.55, body[2] * 0.55);
    sharedUniforms.uColTip.value.fromArray(body);
    sharedUniforms.uSunD.value.fromArray(env.sunD);
    sharedUniforms.uSunC.value.fromArray(env.sunC);
    sharedUniforms.uSunI.value = env.sunI;
    sharedUniforms.uAmb.value = env.amb;
    sharedUniforms.uRim.value = env.sunI * Math.max(0, 1 - env.sunD[1] * 2.4);
    sharedUniforms.uFogC.value.fromArray(env.fogC);
    sharedUniforms.uFogNear.value = env.fogNear;
    sharedUniforms.uFogFar.value = env.fogFar;
    sharedUniforms.uCamPos.value.copy(env.camPos);
    const eg = Math.max(0, (g - 0.58) / 0.42);
    earUniforms.uEarAmt.value = smooth(Math.min(eg, 1));
    earUniforms.uPlantH.value = sharedUniforms.uHeight.value;
    earUniforms.uEarC.value.fromArray(earColor(g));
    ears.visible = eg > 0.01;
  }
  return { group, update, count: N };
}
