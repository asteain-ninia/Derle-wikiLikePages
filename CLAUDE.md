# Derle-wikiLikePages

架空世界の個人用 Wiki。[WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたもの (2026-10-17)。

- 公開: GitHub Pages のまま。`main` へ直接 push → Actions でテスト・ビルド・デプロイ。PR・レビュー・投稿経路は持たない
- remote: `origin` = asteain-ninia/Derle-wikiLikePages, `upstream` = asteain-ninia/WikiLikePages (上流の修正を取り込むときに使う)
- 執筆時は `npm run dev`: 原稿の保存で自動ビルドしてブラウザを再読み込みする
- `docs/spec.md` などの設計文書は上流のもので、多人数・投稿経路に関する記述はこのフォークでは適用しない

## content/ = Obsidian 保管庫 (正本)

- 2026-10-17 に `OneDrive/ドキュメント/Obsidian` の保管庫を `content/` に移した。Obsidian でこのフォルダを開いて書く。元の OneDrive の保管庫はバックアップとして残してある (編集しない)
- 保管庫の旧 git 履歴は、公開記事と画像だけを git filter-repo で抜き出して統合済み (未査読スタブはどの版にも含まれない)
- 記事タイトル = ファイル名 (Obsidian と同じ)。冒頭の太字は別名。カテゴリ = frontmatter の `種別`
- インフォボックスは `src/lib/templates/基礎情報.js` の汎用ハンドラ (「基礎情報 *」全種別 + 市 / 架空言語概要 / Infobox Language)
- `![[画像.png]]` はファイル名だけで解決される (content/ 内のどこに置いてもよい)

## 公開しない原稿 (最重要)

次の原稿は**ビルドにも git にも入れない**。公開リポジトリなのでコミットした時点で公開になる。

- 冒頭に `> [!caution] 未査読` がある (Claude Code が書き起こしたスタブ。本人が査読したらコールアウトを消す運用)
- frontmatter が `種別: メタ` (規約・質問リストなど)
- frontmatter が `公開: false` (書きかけ)
- 記事 (md/wiki/txt) と画像以外のファイル (辞書 json、docx、.base など)。`.obsidian/` は .gitignore

仕組み:

- `build:content` が非公開ファイルを読み飛ばし、`.git/info/exclude` の自動生成ブロックに載せる (ローカル専用なので未公開記事の名前は公開されない)。新しく clone したら `npm run build:content` を一度実行すること
- `.githooks/pre-commit` が非公開原稿のステージを検出してコミットを止める。`core.hooksPath` は `npm install` (prepare) で設定される
- `content/` を `git add -A` しない。`git add -u content` (追跡済みのみ) か、ファイルを確認して個別に add する

## 作業メモ

- 記法は MediaWiki が主軸で、行頭 `#` は番号付きリスト (Markdown の見出しではない)。行頭 `・` は箇条書き
- 記事 ID はパスから拡張子を外したもの。拡張子だけ違う原稿があると `build:content` が失敗する
- `core.autocrlf=true` のため作業ツリーは CRLF。複数行の置換は改行コードに注意
- リスト項目は `{ type: "list-item", markers, body }` (markers は MediaWiki 式の `*` / `#` / `#*` …)。描画は `renderers.js` の `renderList`
- `renderInlineMarkdown` は生成済みタグ・コード・URL をプレースホルダ (U+E020/U+E021) に退避してから強調記法を処理する。nowiki のセンチネルは U+E010〜U+E017
