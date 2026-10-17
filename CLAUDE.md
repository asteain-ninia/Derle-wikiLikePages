# Derle-wikiLikePages

架空世界の個人用 Wiki。[WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたもの (2026-10-17)。

- 公開: GitHub Pages のまま。`main` へ直接 push → Actions でテスト・ビルド・デプロイ。PR・レビュー・投稿経路は持たない
- remote: `origin` = asteain-ninia/Derle-wikiLikePages, `upstream` = asteain-ninia/WikiLikePages (上流の修正を取り込むときに使う)
- 原稿は `content/` (.md/.wiki/.txt)。記法は MediaWiki が主軸で、行頭 `#` は番号付きリスト (Markdown の見出しではない)。行頭 `・` は箇条書き
- 記事 ID はパスから拡張子を外したもの。拡張子だけ違う原稿があると `build:content` が失敗する
- 執筆時は `npm run dev`: 原稿の保存で自動ビルドしてブラウザを再読み込みする
- `docs/spec.md` などの設計文書は上流のもので、多人数・投稿経路に関する記述はこのフォークでは適用しない

## 作業メモ

- `core.autocrlf=true` のため作業ツリーは CRLF。複数行の置換は改行コードに注意
- リスト項目は `{ type: "list-item", markers, body }` (markers は MediaWiki 式の `*` / `#` / `#*` …)。描画は `renderers.js` の `renderList`
- `renderInlineMarkdown` は生成済みタグ・コード・URL をプレースホルダ (U+E020/U+E021) に退避してから強調記法を処理する。nowiki のセンチネルは U+E010〜U+E017
