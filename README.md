# 水田のほとり v3

ながめて、ときどき手をいれる田んぼ。Three.jsによる3D版。

- 空・水・稲・生きもの、すべてコードによるプロシージャル描画（画像・動画素材0枚）
- 実行時の外部通信なし（Three.jsはビルド時にバンドル済み）
- 記録は localStorage のみ。外部送信は一切なし
- 実時間モード／三分で一日モード
- 稲は実時間（約2〜3週間）で実る。退化なし。草は伸び、水は減る

## 開発

```bash
npm install        # 依存の取得（three, vite）
npm run dev        # 開発サーバー（http://localhost:5173）
npm test           # ロジックテスト
npm run build      # docs/ にビルド成果物を出力
```

## GitHub Pages への公開

1. このリポジトリを GitHub に push する（`docs/` を含める）
2. Settings → Pages → Source を **main ブランチの /docs** に設定
3. `https://ユーザー名.github.io/リポジトリ名/` を開いてスマホ実機で確認

更新するとき：ソースを直したら `npm run build` を実行し、`docs/` の変更ごと commit & push。

## 構成

- `src/scene/daycycle.js` … 一日の設計図（空の色・天体・生きものの時間窓）
- `src/scene/sky.js` … スカイドーム。skyColor() は水面の反射でも共用
- `src/scene/water.js` … 波動場＋空の実反射＋波紋＋泥
- `src/scene/paddy.js` … 稲（インスタンシング・風の頂点シェーダー・穂）
- `src/scene/ridge.js` … 畔と草
- `src/scene/creatures.js` … 鳥・カエル・トンボ・蛍・魚の跳ね
- `src/scene/postprocess.js` … ブルーム・ビネット・粒子
- `src/state/` … 生育ロジックと保存
- `src/audio/ambient.js` … Web Audio による環境音合成
- `src/ui/controls.js` … 手入れUI

つくった人：へいなか（公認心理師・元法務教官） https://lit.link/heinaka
