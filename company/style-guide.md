# スタイルガイド（既存3作品から抽出）

参考：`titration-bench-3d` / `flame-test-bench-3d` / `separatory-funnel-3d`（Kaname-chemistry, public）

## 構成
- 1作品＝`index.html` 1ファイル＋`ogp.jpg`（1200×630）。ビルドなし
- three.js は importmap で `https://cdn.jsdelivr.net/npm/three@0.170.0/...` 固定。addons は OrbitControls / RoomEnvironment / RoundedBoxGeometry 程度
- slug は `<実験名>-3d` または `<実験名>-bench-3d`

## メタ
- **UI は日本語**（2026-11 社長指示。前3作は英語UI）。`<html lang="ja">`、title は `日本語の実験名 | Xxx Bench`
- フォントは system-ui の後に Hiragino Sans / Noto Sans JP / Yu Gothic UI / Meiryo
- og:title / twitter:title は `英語タイトル | 日本語の説明`、description は**日本語**で何が再現されているかを具体的に
- og:url / og:image は `https://kaname-chemistry.github.io/<slug>/`、twitter:card は summary_large_image
- `<link rel="icon" href="data:,">`

## 見た目
- 背景 `#c7cfd6` 前後の明るいグレー、文字 `#132331`、system-ui フォント
- 実験台：濃いグレーのノイズテクスチャ天板、壁は白タイル（canvas テクスチャ）
- ガラス器具：MeshPhysicalMaterial（低 opacity＋フレネル縁取り onBeforeCompile）
- ACESFilmic、RoomEnvironment の PMREM、太陽光＋影
- UI はすりガラス風パネル：`background:rgba(244,248,252,.5); backdrop-filter:blur(16px) saturate(1.5); border-radius:16px`
  - 右上 `#hud`（幅~290px）：`.cap` 小見出し（大文字・letter-spacing）＋大きな数値＋ログ
  - 下中央 `#ctrl`（最大700px）：ボタン行・スライダー・`.seg` 切替
  - 左上 `#hint`：`ドラッグで回転 · ホイール / ピンチで拡大`
  - `#toast`：下部中央の暗色トースト（1.7秒）
- ボタン：白半透明、`.on` は `#14303f` 塗り、`.primary` は `#1d6f8f`
- スマホ（max-width:640px）：HUDを縮小し副次情報を非表示、hint を消す

## 振る舞い
- 「よくある失敗」を物理/化学モデルとして再現し、ログに理由を出す（汚染・終点越え など）
- 測定値は HUD に数値で（mL, pH, %, nm など。tabular-nums）
- `window.__<name> = { S, step(sec), hold(on), view(target,pos), ... }` を用意（自動テスト・OGP撮影用、通常動作に影響しない）
- 描画ループは `renderer.setAnimationLoop`、dt 上限 1/20
