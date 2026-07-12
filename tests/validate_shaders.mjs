/* three.js のShaderMaterialからシェーダー文字列を取り出し、
   three が注入する宣言を付けて glslangValidator で検証する */
import { createSky } from "../src/scene/sky.js";
import { createWater } from "../src/scene/water.js";
import { createPaddy } from "../src/scene/paddy.js";
import { createRidge } from "../src/scene/ridge.js";
import fs from "fs";

const VP = `#version 100
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute mat4 instanceMatrix;
`;
const FP = `#version 100
precision highp float;
`;

const sky = createSky();
const water = createWater();
const paddy = createPaddy("low");
const ridge = createRidge("low");

const shaders = [];
function collect(name, obj) {
  obj.traverse ? obj.traverse((o) => {
    if (o.material && o.material.isShaderMaterial) {
      shaders.push([name + "_" + (o.type || "mesh"), o.material]);
    }
  }) : null;
}
shaders.push(["sky", sky.mesh.material]);
shaders.push(["water", water.mesh.material]);
collect("paddy", paddy.group);
collect("ridge", ridge.group);

/* creatures/postprocess はソースから正規表現で取り出す */
const cre = fs.readFileSync("src/scene/creatures.js", "utf-8");
const fireflyV = cre.match(/vertexShader: \/\* glsl \*\/ `\n([\s\S]*?)`,\n    fragmentShader/)[1];
const fireflyF = cre.match(/fragmentShader: \/\* glsl \*\/ `\n([\s\S]*?)`,\n  \}\);\n  const fireflies/)[1];
const post = fs.readFileSync("src/scene/postprocess.js", "utf-8");
const finV = post.match(/vertexShader: \/\* glsl \*\/ `\n([\s\S]*?)`,\n  fragmentShader/)[1];
const finF = post.match(/fragmentShader: \/\* glsl \*\/ `\n([\s\S]*?)`,\n};/)[1];

let n = 0;
const out = [];
function emit(name, vsrc, fsrc, uniforms) {
  /* uniforms宣言はシェーダー本文に既に書かれている（ShaderMaterialの流儀） */
  fs.writeFileSync(`/tmp/sh_${name}.vert`, VP + vsrc);
  fs.writeFileSync(`/tmp/sh_${name}.frag`, FP + fsrc);
  out.push(name);
}
for (const [name, m] of shaders) emit(name.replace(/\W/g, "_"), m.vertexShader, m.fragmentShader);
emit("firefly", fireflyV, "precision highp float;\n" + fireflyF); // frag precisionは付与済みだが二重でも可→やめる
fs.writeFileSync(`/tmp/sh_firefly.frag`, FP + fireflyF);
emit("final", finV, finF);
fs.writeFileSync("/tmp/shader_list.txt", out.join("\n"));
console.log("emitted:", out.join(", "));
