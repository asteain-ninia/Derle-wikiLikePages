# Derle-wikiLikePages

架空世界の個人用 Wiki。[WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたもの (2026-10-17)。

- 公開: GitHub Pages のまま。Actions がテスト・ビルド・デプロイする。きっかけは、このリポジトリの `main` への push (コードの変更) と、手動実行 (`gh workflow run deploy-pages.yml`。記事を出すときはいまはこれ)。PR・レビュー・投稿経路は持たない
- remote: `origin` = asteain-ninia/Derle-wikiLikePages, `upstream` = asteain-ninia/WikiLikePages (上流の修正を取り込むときに使う)
- `docs/spec.md` などの設計文書は上流のもので、多人数・投稿経路に関する記述はこのフォークでは適用しない

## 記事の正本は保管庫 (本文も履歴も)。このリポジトリはコードだけ

- 正本: `C:/Users/…/OneDrive/ドキュメント/出界百科` (2026-11-21 に `Obsidian` から改名。2 台の PC で OneDrive 同期。未査読スタブ・辞書なども全部ここ)。git のリポジトリでもあり、`origin` は非公開の asteain-ninia/derle-vault。**記事をコミットする場所はここだけ**
- `npm run sync` が保管庫から **frontmatter に `公開: true` がある原稿** と、それらが名前を書いている画像だけを `content/` にコピーする。`content/` は生成物で git に入れない (`.gitignore`)。保管庫に無いもの・公開をやめたものは消える。`content/` を直接編集しない・コミットしない
- 保管庫の場所は PC ごとに `local.config.json` (`{ "vaultPath": "…" }`、git 管理外) か環境変数 `DERLE_VAULT` で指定
- `npm run dev` は保管庫も監視し、保存のたびに同期 → ビルド → ブラウザ再読み込み
- 公開の流れ: 保管庫の記事に `公開: true` を書く → 保管庫でコミット → push → Actions を実行。Actions は保管庫を読み取り専用の deploy key (このリポジトリの secret `VAULT_DEPLOY_KEY`) で取得し、その中で sync とビルドをする (`.github/workflows/deploy-pages.yml`)。保管庫の push で自動的に Actions を起こす仕組み (`repository_dispatch` の `vault-updated`) は受け口だけあり、保管庫側は未設定
- 記事の更新履歴 = 保管庫のコミットの文言 (Wikipedia の編集要約と同じ扱い)。保管庫でその記事に触れたコミットは全部載る。載せたくないコミット (`公開: true` の付与、機械的な一括整理など) は文言を `chore:` で始める。記事の「作成」日は最初のコミット、「更新」日は履歴に載るコミットの最新 (`scripts/vault-git.mjs`、`src/lib/article-history.js`)
- 履歴の文言は、その時点の版のページ `article/<記事 ID>/rev/<コミットの短い名前>/` へのリンク。`build:content` が保管庫の git から昔の原稿を読んで `.generated/article-revisions.json` (git 管理外、`src/` の外) に書き、`build:site` と開発サーバーが静的ページにする (`buildStaticRevisionPage`)。公開前の版も載せる。古い版のページは noindex で sitemap に入れず、昔の版にしか無い画像は出ない
- frontmatter は単純な形 (空行 / `キー: 値` / `- 項目`) だけを解釈し、読めない形式は公開しない (fail-closed)。sync が名前を表示する
- 未査読・メタなどの区別は保管庫側の運用で、このリポジトリのコードは知らない (オプトインの `公開: true` だけを見る)
- 2026-10-17〜11-05 にこのリポジトリの `content/` へ直接入れた記事のコミット 4 件は、2026-11-21 に保管庫の履歴へ積み直した。このリポジトリの git 履歴に残る `content/` は移行前のもの

## 表示の決まり

- 記事タイトル = ファイル名 (Obsidian と同じ)。冒頭の太字は別名。カテゴリ = frontmatter の `種別`
- インフォボックスは `src/lib/templates/基礎情報.js` の汎用ハンドラ (「基礎情報 *」全種別 + 市 / 架空言語概要 / Infobox Language)
- `![[画像.png]]` はファイル名だけで解決される
- 記法は MediaWiki が主軸で、行頭 `#` は番号付きリスト (Markdown の見出しではない)。行頭 `・` は箇条書き
- 表は MediaWiki 形式 (`{| … |}`) と Markdown 形式 (`| … |` + 区切り行) の両方を読む。原稿は Obsidian で表に見える Markdown 形式で書かれている。見出しが全部空の行は描画しない
- 素の引用 (`> テキスト`) は `<blockquote>` と同じ描画で、Obsidian に合わせて行ごとに改行する。`> [!type]` は callout
- デーレ文字は `src/fonts/asteain.woff2` で表示する (正本はユーザーフォントの asteain.ttf を変換したもの。U+F2700〜F2FFF にだけ適用)。フォントを更新したら作り直す
- 記事 ID はパスから拡張子を外したもの。拡張子だけ違う原稿があると `build:content` が失敗する

## 作業メモ

- `core.autocrlf=true` のため作業ツリーは CRLF。複数行の置換は改行コードに注意
- 画像が大きい (計 90MB 程度) ので、このリポジトリは `http.postBuffer` を 500MB にしてある (ローカル設定)
- リスト項目は `{ type: "list-item", markers, body }` (markers は MediaWiki 式の `*` / `#` / `#*` …)。Markdown 式の字下げ (タブか、親より 2 文字以上深いスペース) も markers の深さにする (`content-import.js` の `buildIndentedListMarkers`)。描画は `renderers.js` の `renderList`
- `renderInlineMarkdown` は生成済みタグ・コード・URL をプレースホルダ (U+E020/U+E021) に退避してから強調記法を処理する。nowiki のセンチネルは U+E010〜U+E017。`<ref>` の脚注番号は `content-import.js` が U+E018〜U+E019 で挟んで本文に残し、描画で脚注の一覧 (`id="fn-N"`) へ飛ぶ上付きのリンク `[N]` にする (ページ内の id へのリンクは `main.js` が自分で移動する。ハッシュを変えるとメインページへ戻るため)
- `build:content` は記事データと一緒にリンクの解決結果 (`backlinks.json` など) と保守レポート (`src/data/generated/maintenance-report.md`: 孤立・行き止まり・未解決リンク・リンク密度) を書き出す。組み立ては `src/lib/build-artifacts.js` で、リンク解決は `buildWikiGraph` を使う。サイト内では `#!maintenance` (メインページ下の小さなリンク) が `maintenance-report.json` を読んで記事と同じ見た目で表示する
- サイト名は「出界百科」(`index.html` と `src/data/site-config.js` の `siteName`)
- `npm run build:site` は SPA のコピーに加えて、記事ごとの静的ページ `dist/article/<記事 ID>/index.html` (カテゴリは `dist/category/<名前>/`)・`sitemap.xml`・`robots.txt` を書き出す (`src/lib/static-pages.js`)。本文は SPA と同じ描画関数で描き、JavaScript は読み込まない。canonical・OGP の絶対 URL は `site-config.js` の `siteUrl` (Actions では Pages の URL を `SITE_URL` で渡す)。`npm run dev` でも `/article/…/` を開ける。記事画面の「固定リンク」がこの URL
- 節は見出しの深さ `level` を持つ (## = 2)。目次は深さで入れ子にし、本文の見出しは ## を h3、### 以下を h4〜h6 にする
- 画像は `build:content` が縦横を調べて `imageSizes` (content-data.js) に入れ、img に width / height を付ける。遅延読み込みの画像が後から伸びて見出しへの移動位置がずれるのを防ぐため
