# Derle-wikiLikePages

架空世界の個人用 Wiki。[WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたもの (2026-10-17)。

- 公開: GitHub Pages のまま。`main` へ直接 push → Actions でテスト・ビルド・デプロイ。PR・レビュー・投稿経路は持たない
- remote: `origin` = asteain-ninia/Derle-wikiLikePages, `upstream` = asteain-ninia/WikiLikePages (上流の修正を取り込むときに使う)
- `docs/spec.md` などの設計文書は上流のもので、多人数・投稿経路に関する記述はこのフォークでは適用しない

## 正本は OneDrive の Obsidian 保管庫、content/ はそのミラー

- 正本: `C:/Users/…/OneDrive/ドキュメント/Obsidian` (2 台の PC で OneDrive 同期。未査読スタブ・辞書なども全部ここ)
- `npm run sync` が保管庫から **frontmatter に `公開: true` がある原稿** と、それらが名前を書いている画像だけを `content/` にコピーする。`content/` は生成物で、保管庫に無いもの・公開をやめたものは消える。`content/` を直接編集しない
- 保管庫の場所は PC ごとに `local.config.json` (`{ "vaultPath": "…" }`、git 管理外) か環境変数 `DERLE_VAULT` で指定
- `npm run dev` は保管庫も監視し、保存のたびに同期 → ビルド → ブラウザ再読み込み
- 公開の流れ: 保管庫の記事に `公開: true` を書く → `npm run sync` → `content/` の差分をコミット → push
- frontmatter は単純な形 (空行 / `キー: 値` / `- 項目`) だけを解釈し、読めない形式は公開しない (fail-closed)。sync が名前を表示する
- 未査読・メタなどの区別は保管庫側の運用で、このリポジトリのコードは知らない (オプトインの `公開: true` だけを見る)
- 保管庫の旧 git 履歴 (2026-05-02〜) は、公開記事 26 件と画像だけを git filter-repo で抜き出して統合済み

## 表示の決まり

- 記事タイトル = ファイル名 (Obsidian と同じ)。冒頭の太字は別名。カテゴリ = frontmatter の `種別`
- インフォボックスは `src/lib/templates/基礎情報.js` の汎用ハンドラ (「基礎情報 *」全種別 + 市 / 架空言語概要 / Infobox Language)
- `![[画像.png]]` はファイル名だけで解決される
- 記法は MediaWiki が主軸で、行頭 `#` は番号付きリスト (Markdown の見出しではない)。行頭 `・` は箇条書き
- 記事 ID はパスから拡張子を外したもの。拡張子だけ違う原稿があると `build:content` が失敗する

## 作業メモ

- `core.autocrlf=true` のため作業ツリーは CRLF。複数行の置換は改行コードに注意
- 画像が大きい (計 90MB 程度) ので、このリポジトリは `http.postBuffer` を 500MB にしてある (ローカル設定)
- リスト項目は `{ type: "list-item", markers, body }` (markers は MediaWiki 式の `*` / `#` / `#*` …)。描画は `renderers.js` の `renderList`
- `renderInlineMarkdown` は生成済みタグ・コード・URL をプレースホルダ (U+E020/U+E021) に退避してから強調記法を処理する。nowiki のセンチネルは U+E010〜U+E017
