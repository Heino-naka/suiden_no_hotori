/* =========================================================
   ポストプロセス：ブルーム＋ビネット＋粒子
   ========================================================= */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.045 },
    uVig: { value: 0.34 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVig;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float v = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.42, 0.86, v) * uVig;
      float g = (hash(vUv * 907.0 + fract(uTime) * 61.0) - 0.5) * uGrain;
      col += g;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera, tier, reduceMotion) {
  if (tier === "low") return null;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.85, 0.82);
  composer.addPass(bloom);
  const final = new ShaderPass(FinalShader);
  if (reduceMotion) final.uniforms.uGrain.value = 0;
  composer.addPass(final);
  function setSize(w, h, dpr) { composer.setSize(w, h); composer.setPixelRatio(dpr); }
  function update(time) { final.uniforms.uTime.value = time; }
  function render() { composer.render(); }
  return { setSize, update, render, bloom };
}
