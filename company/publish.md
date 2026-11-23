# 公開手順（社長作業・G4承認後）

既存作品と同じく **1作品＝1公開リポジトリ** で GitHub Pages に出す。

1. GitHub で `Kaname-chemistry/<slug>` を **Public** で新規作成（README なし）
2. このリポジトリの `apps/<slug>/index.html` と `apps/<slug>/ogp.jpg` の2つだけをアップロード（Add file → Upload files）
3. Settings → Pages → Branch: `main` / `(root)` → Save
4. 1〜2分後に `https://kaname-chemistry.github.io/<slug>/` を開いて動作確認
5. X のカード確認：投稿画面に URL を貼って、OGP 画像が出るか確認してから投稿

> 執行役に「公開リポジトリを作って」と指示すれば、非公開で作成して push までは代行できる（Public への切り替えと Pages の有効化は社長が行う）。

## 公開状況
| slug | 公開用リポジトリ | 状態 |
|---|---|---|
| baking-soda-decomposition-3d | Kaname-chemistry/baking-soda-decomposition-3d | Public 済み。**社長作業：Pages を有効化（Settings → Pages → main / root → Save）** |
| water-electrolysis-3d | Kaname-chemistry/water-electrolysis-3d | index.html と ogp.jpg を main に push 済み（非公開）。**社長作業：Public に切り替え → Pages を有効化** |
| metal-tree-3d | Kaname-chemistry/metal-tree-3d | index.html と ogp.jpg を main に push 済み（非公開）。**社長作業：Public に切り替え → Pages を有効化** |
