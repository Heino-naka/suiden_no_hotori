/* =========================================================
   畔：手前の土手と草。草の丈は state.grass を映す。
   ========================================================= */
import * as THREE from "three";
import { mulberry } from "./daycycle.js";

export function createRidge(tier) {
  const group = new THREE.Group();

  /* 土手：ゆるい起伏のある帯 */
  const soilGeo = new THREE.PlaneGeometry(70, 5.5, 60, 8);
  const pos = soilGeo.attributes.position;
  const rnd = mulberry(31);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const bump = Math.sin(x * 0.4) * 0.05 + rnd() * 0.03;
    pos.setZ(i, bump + Math.max(0, 1 - Math.abs(y) / 2.75) * 0.28);
  }
  soilGeo.computeVertexNormals();
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x584834 });
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(0, 0.005, 4.2);
  group.add(soil);

  /* 草：一枚葉のインスタンス */
  const N = tier === "high" ? 1500 : tier === "mid" ? 900 : 500;
  const bladeGeo = new THREE.PlaneGeometry(0.012, 1, 1, 4);
  bladeGeo.translate(0, 0.5, 0);
  const uniforms = {
    uTime: { value: 0 }, uWind: { value: 0.3 }, uLen: { value: 0.15 },
    uColA: { value: new THREE.Color(0x4c6b2e) }, uColB: { value: new THREE.Color(0x8aa34f) },
    uAmb: { value: 1 },
  };
  const grassMat = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime, uWind, uLen;
      varying float vHf;
      void main(){
        vHf = uv.y;
        vec3 p = position;
        p.y *= (0.25 + uLen * 1.15) * aScale;
        vec4 wp = instanceMatrix * vec4(p, 1.0);
        float sway = uWind * sin(uTime * 2.4 + aPhase - wp.x * 0.5) * vHf * vHf;
        wp.x += sway * 0.16;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vHf;
      uniform vec3 uColA, uColB;
      uniform float uAmb;
      void main(){
        vec3 col = mix(uColA, uColB, vHf) * (0.25 + uAmb * 0.8);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, N);
  const dummy = new THREE.Object3D();
  const aPhase = new Float32Array(N), aScale = new Float32Array(N);
  const rnd2 = mulberry(77);
  for (let i = 0; i < N; i++) {
    const x = (rnd2() - 0.5) * 60;
    const z = 2.2 + rnd2() * 4.2;
    const bump = Math.sin(x * 0.4) * 0.05;
    dummy.position.set(x, 0.24 + bump, z);
    dummy.rotation.y = rnd2() * Math.PI;
    dummy.rotation.z = (rnd2() - 0.5) * 0.4;
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    aPhase[i] = rnd2() * Math.PI * 2;
    aScale[i] = 0.6 + rnd2() * 0.8;
  }
  bladeGeo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
  bladeGeo.setAttribute("aScale", new THREE.InstancedBufferAttribute(aScale, 1));
  grass.instanceMatrix.needsUpdate = true;
  grass.frustumCulled = false;
  group.add(grass);

  function update(env) {
    uniforms.uTime.value = env.time;
    uniforms.uWind.value = env.wind * (env.reduceMotion ? 0.3 : 1);
    uniforms.uLen.value = env.state.grass;
    uniforms.uAmb.value = env.amb;
    const amb = env.amb;
    soilMat.color.setRGB(0.345 * (0.3 + amb * 0.8), 0.282 * (0.3 + amb * 0.8), 0.204 * (0.3 + amb * 0.8));
  }
  return { group, update };
}
