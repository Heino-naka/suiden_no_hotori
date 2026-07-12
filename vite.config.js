import { defineConfig } from "vite";

// GitHub Pages（https://ユーザー名.github.io/リポジトリ名/）で動くよう相対パスにする。
// ビルド成果物は docs/ に出力し、Pages の Source を main ブランチの /docs に設定する。
export default defineConfig({
  base: "./",
  build: {
    outDir: "docs",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
