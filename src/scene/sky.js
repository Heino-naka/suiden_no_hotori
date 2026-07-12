/* =========================================================
   空：スカイドーム。
   skyColor() は水面の反射でも同じ式を使う（共有GLSL）。
   雲・星・太陽・月をすべて方向関数として解析的に描くため、
   水面はこの関数を反射レイで評価するだけで空を正確に映せる。
   ========================================================= */
import * as THREE from "three";

export const SKY_GLSL = /* glsl */ `
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash21(i), hash21(i+vec2(1,0)), u.x),
             mix(hash21(i+vec2(0,1)), hash21(i+vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ v += a*vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}

/* dir は正規化された視線方向。空の色＋太陽＋月＋雲＋星を返す。 */
vec3 skyColor(vec3 dir, vec3 topC, vec3 hzC,
              vec3 sunD, vec3 sunC, float sunI,
              vec3 moonD, float moonI,
              float night, float amb, float cloudDrift, float starTwinkle){
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(hzC, topC, pow(t, 0.5));

  /* 地平の霞（大気の厚み） */
  col = mix(col, hzC * (0.85 + amb * 0.3), exp(-t * 7.0) * 0.55);

  /* 太陽：芯・暈・にじみ */
  float sd = max(dot(dir, sunD), 0.0);
  col += sunC * (pow(sd, 3000.0) * 4.0 + pow(sd, 220.0) * 0.9 + pow(sd, 18.0) * 0.28 + pow(sd, 5.0) * 0.10) * sunI;

  /* 月 */
  float md = max(dot(dir, moonD), 0.0);
  col += vec3(0.86, 0.90, 0.98) * (pow(md, 6000.0) * 2.4 + pow(md, 260.0) * 0.35 + pow(md, 24.0) * 0.06) * moonI;

  /* 星（夜のみ・雲に隠れる前に加算し、雲側で減衰） */
  float star = 0.0;
  if (night > 0.02 && dir.y > 0.0) {
    vec2 sp = dir.xz / (dir.y + 0.28) * 48.0;
    vec2 cell = floor(sp);
    float h = hash21(cell);
    if (h > 0.992) {
      vec2 c = fract(sp) - 0.5;
      float d = length(c);
      float tw = 0.6 + 0.4 * sin(starTwinkle * (1.0 + h * 4.0) + h * 40.0);
      star = smoothstep(0.16, 0.0, d) * night * tw * 0.9;
    }
  }
  col += vec3(0.92, 0.95, 1.0) * star;

  /* 雲：方向を平面に投影したfbm。水面反射でも同じ雲が映る */
  if (dir.y > 0.015) {
    vec2 cuv = dir.xz / (dir.y + 0.14) * 0.55 + vec2(cloudDrift, cloudDrift * 0.35);
    float c1 = fbm(cuv);
    float c2 = fbm(cuv * 2.7 + 13.4);
    float cov = smoothstep(0.52, 0.74, c1 * 0.72 + c2 * 0.28);
    cov *= smoothstep(0.015, 0.12, dir.y);            /* 地平ぎわで薄れる */
    vec3 cloudLit = mix(hzC, vec3(1.0), amb * 0.85);   /* 昼は白く夜は沈む */
    cloudLit *= 0.55 + amb * 0.6;
    /* 夕方は雲の腹が染まる */
    float sunLow = clamp(1.0 - sunD.y * 2.6, 0.0, 1.0) * sunI;
    cloudLit = mix(cloudLit, sunC * 1.05, sunLow * 0.45 * smoothstep(0.3, 0.9, sd));
    col = mix(col, cloudLit, cov * 0.72);
    col += vec3(star) * -min(star, cov);               /* 雲の裏の星を消す */
  }
  return col;
}
`;

export function createSky() {
  const uniforms = {
    uTop:    { value: new THREE.Vector3() },
    uHz:     { value: new THREE.Vector3() },
    uSunD:   { value: new THREE.Vector3(0, 1, 0) },
    uSunC:   { value: new THREE.Vector3(1, 0.95, 0.8) },
    uSunI:   { value: 0 },
    uMoonD:  { value: new THREE.Vector3(0, 1, 0) },
    uMoonI:  { value: 0 },
    uNight:  { value: 0 },
    uAmb:    { value: 1 },
    uDrift:  { value: 0 },
    uTime:   { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w;   /* 常に最遠 */
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uTop, uHz, uSunD, uSunC, uMoonD;
      uniform float uSunI, uMoonI, uNight, uAmb, uDrift, uTime;
      ${SKY_GLSL}
      void main(){
        vec3 col = skyColor(normalize(vDir), uTop, uHz, uSunD, uSunC, uSunI,
                            uMoonD, uMoonI, uNight, uAmb, uDrift, uTime);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 40, 24), mat);
  mesh.frustumCulled = false;

  function update(env) {
    uniforms.uTop.value.fromArray(env.top);
    uniforms.uHz.value.fromArray(env.hz);
    uniforms.uSunD.value.fromArray(env.sunD);
    uniforms.uSunC.value.fromArray(env.sunC);
    uniforms.uSunI.value = env.sunI;
    uniforms.uMoonD.value.fromArray(env.moonD);
    uniforms.uMoonI.value = env.moonI;
    uniforms.uNight.value = env.night;
    uniforms.uAmb.value = env.amb;
    uniforms.uDrift.value = env.time * 0.004 * (0.5 + env.wind * 0.8);
    uniforms.uTime.value = env.time;
  }
  return { mesh, update, uniforms };
}
