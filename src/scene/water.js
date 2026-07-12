/* =========================================================
   水面：世界座標の波動場から法線を解析的に求め、
   反射レイで skyColor() を評価する（空の実反射）。
   波紋はリング波として波動場に加算。
   水位が下がると泥が斑にのぞく。
   ========================================================= */
import * as THREE from "three";
import { SKY_GLSL } from "./sky.js";

const RIP_N = 16;

export function createWater() {
  const rippleArr = [];
  for (let i = 0; i < RIP_N; i++) rippleArr.push(new THREE.Vector4(0, 0, -100, 0));
  let ripIdx = 0;

  const uniforms = {
    uTime:   { value: 0 },
    uWind:   { value: 0.3 },
    uLevel:  { value: 0.6 },
    uTop:    { value: new THREE.Vector3() },
    uHz:     { value: new THREE.Vector3() },
    uSunD:   { value: new THREE.Vector3(0, 1, 0) },
    uSunC:   { value: new THREE.Vector3(1, 1, 1) },
    uSunI:   { value: 0 },
    uMoonD:  { value: new THREE.Vector3(0, 1, 0) },
    uMoonI:  { value: 0 },
    uNight:  { value: 0 },
    uAmb:    { value: 1 },
    uDrift:  { value: 0 },
    uDeep:   { value: new THREE.Vector3(0.05, 0.12, 0.10) },
    uShal:   { value: new THREE.Vector3(0.12, 0.22, 0.19) },
    uFogC:   { value: new THREE.Vector3(0.8, 0.85, 0.9) },
    uFogNear:{ value: 30 },
    uFogFar: { value: 180 },
    uCamPos: { value: new THREE.Vector3() },
    uRip:    { value: rippleArr },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      uniform float uTime, uWind, uLevel, uSunI, uMoonI, uNight, uAmb, uDrift, uFogNear, uFogFar;
      uniform vec3 uTop, uHz, uSunD, uSunC, uMoonD, uDeep, uShal, uFogC, uCamPos;
      uniform vec4 uRip[${RIP_N}];
      ${SKY_GLSL}

      /* 波動場：高さと勾配を同時に返す（解析微分） */
      vec3 waveField(vec2 p, float t, float wind){
        float h = 0.0; vec2 g = vec2(0.0);
        /* うねり（大→小） */
        vec2 d1 = normalize(vec2( 0.8, 0.6));
        vec2 d2 = normalize(vec2(-0.6, 0.8));
        vec2 d3 = normalize(vec2( 0.2,-1.0));
        vec2 d4 = normalize(vec2(-1.0,-0.3));
        float a1=0.030, k1=0.9,  s1=0.9;
        float a2=0.018, k2=1.7,  s2=1.3;
        float a3=0.012*(0.4+wind), k3=3.6, s3=2.2;
        float a4=0.008*(0.3+wind), k4=6.8, s4=3.4;
        float ph;
        ph = dot(p,d1)*k1 + t*s1; h += a1*sin(ph); g += d1*k1*a1*cos(ph);
        ph = dot(p,d2)*k2 + t*s2; h += a2*sin(ph); g += d2*k2*a2*cos(ph);
        ph = dot(p,d3)*k3 + t*s3; h += a3*sin(ph); g += d3*k3*a3*cos(ph);
        ph = dot(p,d4)*k4 + t*s4; h += a4*sin(ph); g += d4*k4*a4*cos(ph);
        /* 風の細波 */
        vec2 d5 = normalize(vec2(0.9,-0.5));
        float a5=0.004*(0.2+wind*1.2), k5=14.0, s5=6.0;
        ph = dot(p,d5)*k5 + t*s5; h += a5*sin(ph); g += d5*k5*a5*cos(ph);
        return vec3(h, g);
      }

      void main(){
        vec2 p = vWorld.xz;
        vec3 wf = waveField(p, uTime, uWind);
        vec2 grad = wf.yz;

        /* 波紋（リング波） */
        for (int i = 0; i < ${RIP_N}; i++) {
          vec4 r = uRip[i];
          float age = uTime - r.z;
          if (r.w <= 0.001 || age < 0.0 || age > 4.0) continue;
          vec2 dv = p - r.xy;
          float dist = length(dv);
          float front = age * 1.6;
          float ring = dist - front;
          float env = exp(-age * 1.1) * exp(-abs(ring) * 2.4) * r.w;
          float k = 22.0;
          grad += (dv / max(dist, 0.001)) * cos(ring * k) * env * 0.55;
        }

        vec3 n = normalize(vec3(-grad.x, 1.0, -grad.y));

        vec3 V = normalize(vWorld - uCamPos);
        vec3 R = reflect(V, n);
        R.y = abs(R.y) + 0.015;                       /* 水面下は見せない */
        R = normalize(R);

        /* 空の実反射（スカイドームと同じ式） */
        vec3 sky = skyColor(R, uTop, uHz, uSunD, uSunC, uSunI,
                            uMoonD, uMoonI, uNight, uAmb, uDrift, uTime);

        /* 水の地色（視距離で深→浅） */
        float dist = length(vWorld - uCamPos);
        vec3 body = mix(uDeep, uShal, clamp(dist / 60.0, 0.0, 1.0));
        body *= 0.55 + uAmb * 0.65;

        /* フレネル */
        float F = 0.03 + 0.97 * pow(1.0 - max(dot(-V, n), 0.0), 5.0);
        F = clamp(F * (0.55 + uLevel * 0.6), 0.0, 1.0);
        vec3 col = mix(body, sky, F);

        /* 光の道：反射レイの鏡面（本物のスペキュラ） */
        float low = clamp(1.0 - uSunD.y * 2.4, 0.0, 1.0);
        float spec = pow(max(dot(R, uSunD), 0.0), mix(700.0, 180.0, low));
        col += uSunC * spec * uSunI * (1.6 + low * 2.4);
        float mspec = pow(max(dot(R, uMoonD), 0.0), 900.0);
        col += vec3(0.85, 0.90, 0.98) * mspec * uMoonI * 1.4;

        /* 水が引くと泥がのぞく */
        float mudAmt = smoothstep(0.42, 0.10, uLevel);
        if (mudAmt > 0.001) {
          float patch = fbm(p * 0.55 + 7.3);
          float m = smoothstep(0.66 - mudAmt * 0.34, 0.74 - mudAmt * 0.3, patch);
          vec3 mud = vec3(0.34, 0.27, 0.19) * (0.35 + 0.75 * uAmb);
          mud *= 0.85 + 0.3 * fbm(p * 3.1);
          col = mix(col, mud, m * mudAmt);
        }

        /* 霧 */
        float fogT = smoothstep(uFogNear, uFogFar, dist);
        col = mix(col, uFogC, fogT);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;

  function addRipple(x, z, amp, time) {
    const v = rippleArr[ripIdx];
    v.set(x, z, time, amp);
    ripIdx = (ripIdx + 1) % RIP_N;
  }

  function update(env) {
    uniforms.uTime.value = env.time;
    uniforms.uWind.value = Math.min(env.wind, 1.2);
    uniforms.uLevel.value = env.state.water;
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
    const amb = env.amb;
    uniforms.uDeep.value.set(0.030 + 0.05 * amb, 0.075 + 0.09 * amb, 0.065 + 0.08 * amb);
    uniforms.uShal.value.set(0.06 + 0.09 * amb, 0.13 + 0.13 * amb, 0.115 + 0.12 * amb);
    uniforms.uFogC.value.fromArray(env.fogC);
    uniforms.uFogNear.value = env.fogNear;
    uniforms.uFogFar.value = env.fogFar;
    uniforms.uCamPos.value.copy(env.camPos);
  }
  return { mesh, update, addRipple };
}
