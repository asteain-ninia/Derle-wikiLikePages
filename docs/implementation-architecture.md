# WikiLikePages 実装アーキテクチャ v0.3

> **個人用フォークについて**: このリポジトリは [WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたものです。
> 本書のうち複数参加者・投稿経路 (Pull Request レビュー、Issue Form、外部フォーム) に関する記述は、このフォークでは適用しません。原稿は `content/` に置いて `main` へ直接 push します。

## 1. 目的

このプロジェクトの実装構成と各レイヤの責務を定義する。

- ルートには本番系の `index.html` と `src/` のみを置く
- 旧試作品は `archive/prototypes/` に隔離し、参照専用にする
- 画面実装はデータ、ロジック、描画を分離してテスト可能にする
- 原稿の取り込みはビルド時のスクリプトが担い、ブラウザには変換済みデータだけを渡す

## 2. ディレクトリ構成

```text
.github/
  workflows/
    deploy-pages.yml          # CI: テスト → ビルド → Pages デプロイ
archive/
  prototypes/
    ornate/                   # 旧試作 (装飾版)
    simple/                   # 旧試作 (簡素版)
content/
  samples/                    # サンプル原稿 (本番公開対象外)
  {任意名フォルダ}/            # 本番原稿
docs/
  spec.md
  implementation-architecture.md
scripts/
  generate-content-data.mjs   # content/ → content-data.js 生成
  build-site.mjs              # dist/ への静的ファイル出力
  dev-server.mjs              # 開発用 HTTP サーバー
src/
  data/
    articles.js               # generated/content-data.js の re-export
    site-config.js             # カテゴリ定義・参加導線・UI設定
    generated/
      content-data.js          # ビルド生成物 (記事レコード配列)
  lib/
    content-import.js          # 原稿取り込み・正規化
    home-page-model.js         # ホームページモデル
    article-page-model.js      # 記事・グラフ・リンク解決モデル
    renderers.js               # HTML 描画
    template-registry.js       # テンプレートプラグイン自動検出・登録
    templates/                 # テンプレートハンドラ (プラグイン方式)
      基礎情報-国.js            #   国家インフォボックス
      架空.js                  #   架空世界ノーティス
  main.js                      # エントリポイント・ルーティング・イベント
  styles.css                   # Wikipedia 風スタイル
tests/
  home-page-model.test.js
  renderers.test.js
  content-import.test.js
  article-page-model.test.js
index.html                     # メインページ
package.json
```

## 3. レイヤ構成

### 3.1 Source Content

- `content/`
    - 原稿本文、画像、添付ファイルの置き場
    - 対応拡張子: `.md`, `.wiki`, `.txt` (テキストファイルであれば拡張子によらず同一パイプラインで処理する)
    - 入力記法は MediaWiki風Wiki記法、標準Markdown、Obsidian記法の混在を許容する
    - 同一ファイル内で記法を混在させてもよい (例: Markdown 見出しと MediaWiki テーブルの共存)
    - サブフォルダの存在を許容し、content フォルダ内はすべて再帰的走査の対象となる
- `content/samples/`
    - parser 検証や表示確認に使うサンプル原稿
    - 本番公開対象からは除外する
    - 本番原稿が 0 件のとき、表示確認用のフォールバックとして使う

### 3.2 Build Scripts

ビルドパイプラインは `scripts/` 配下の Node.js スクリプトで構成する。

- `generate-content-data.mjs`
    - `content/` 配下の対応拡張子ファイル (`.md`, `.wiki`, `.txt`) を再帰的に収集する
    - 各ファイルに対して `content-import.js` の `buildArticleRecord()` を呼び、記事レコードを生成する
    - Git 履歴 (`git log --follow`) から created / updated 日付を取得する
    - 結果を `src/data/generated/content-data.js` に ES Module として書き出す
    - `draft: true` の原稿は除外し、本番原稿が 0 件ならサンプルにフォールバックする
- `build-site.mjs`
    - `generate-content-data.mjs` を実行した後、`index.html`、`src/`、アセット類を `dist/` にコピーする
    - `.nojekyll` を配置して Jekyll 処理を抑止する
- `dev-server.mjs`
    - プロジェクトルートをドキュメントルートとする簡易 HTTP サーバー

### 3.3 Import / Normalize (`src/lib/content-import.js`)

原稿ファイルから記事レコードを生成する取り込み層。ビルドスクリプトから呼ばれる。

実装済みの処理:

- frontmatter パース (簡易 YAML)
- 先頭 MediaWiki 風テンプレート抽出 (`{{テンプレート名|...}}`)
- Markdown 見出し・段落・リスト分割
- セクション本文のインライン書式保持 (bold/italic/code は描画層まで保持する)
- summary/preview 用のインライン書式除去 (プレーンテキスト化)
- インラインテンプレート除去 (`{{...}}`)
- wikilink のプレーンテキスト化 (summary/preview 用)
- タイトル推定 (frontmatter → 先頭太字 → ファイル名)
- カテゴリ推定 (frontmatter → テンプレート名 → タイトルパターン)
- summary / preview / keywords / relatedTitles 自動抽出
- draft / isSample フラグ判定
- テンプレートハンドラ適用 (`templateHandlers` 引数を通じて `templateModels` を生成)
- callout 記法パース (`> [!type] Title` → callout オブジェクト)
- 安全なインライン HTML タグの保持 (`<small>`, `<sup>`, `<sub>` のみ)

未実装 → 実装対象の処理 (MediaWiki 記法対応):

- **MediaWiki 見出し**: `== H2 ==`, `=== H3 ===`, `==== H4 ====` を Markdown 見出しと同列に扱う
- **MediaWiki テーブル**: `{| ... |}` ブロックを構造化テーブルオブジェクトとしてパースする
- **MediaWiki 箇条書き**: `*` / `#` で始まる行をリスト項目として取り込む (Markdown `-` と同列)
- **`<ref>` 脚注**: `<ref>注釈テキスト</ref>` を収集し、`<references />` の位置に脚注リストを挿入する
- **`<blockquote>`**: ブロック引用としてパースし、段落オブジェクトに格納する
- **`<br>` / `<br/>`**: インライン改行として保持する
- **`[[ファイル:...]]` / `[[File:...]]`**: MediaWiki 画像記法を画像埋め込みに変換する
- **`[[Category:...]]`**: 記事末尾のカテゴリタグを tags として抽出する
- **`{{main|...}}`**: 「詳細は〇〇を参照」リンクとして表示する (新テンプレートハンドラ)

#### 設計方針: 正規化統合モデル

MediaWiki 記法と Markdown 記法は同一ファイル内で混在してよい。`content-import.js` は両方の記法を認識し、**同一の中間表現** (セクション・段落・リスト・テーブル・テンプレートモデル) に正規化する。これによりモデル層 (`article-page-model.js`) と描画層 (`renderers.js`) は記法の違いを意識しない。

```text
入力 (混在OK)                      中間表現 (統一)
───────────────                    ──────────────
== 見出し ==     ─┐
## 見出し        ─┤──→  section { heading, paragraphs[] }
                  │
* 項目           ─┤──→  "・項目" (リスト段落)
- 項目           ─┘
** ネスト項目    ────→  "　・項目" (インデント付きリスト段落)

; 用語 : 説明   ────→  { type: "definition-list", items[] }

{| ... |}        ────→  { type: "table", ... } (テーブル段落)

<ref>注</ref>    ────→  脚注番号に置換 + footnotes[] 配列

<blockquote>     ────→  { type: "blockquote", ... } (引用段落)

<nowiki>         ────→  リテラルテキスト (記法解釈を抑制)

<poem>           ────→  { type: "poem", ... } (改行保持ブロック)

<syntaxhighlight>────→  { type: "code-block", ... } (整形済みテキスト)

----             ────→  { type: "hr" } (水平線)

[[Category:X]]   ────→  tags[] に追加

[[ファイル:X]]    ────→  画像埋め込みセグメント (embed)

#REDIRECT [[X]]  ────→  aliases に追加 (リダイレクト元として処理)

__TOC__ etc.     ────→  除去 (目次制御は Phase 2)
```

### 3.4 Template Plugin System (`src/lib/template-registry.js`, `src/lib/templates/`)

テンプレートハンドラをプラグイン方式で管理する仕組み。

#### アーキテクチャ

```text
src/lib/templates/
  基礎情報-国.js     # 国家インフォボックス
  架空.js            # 架空世界ノーティス
  (新規テンプレート.js)  # フォルダに置くだけで自動認識
```

各テンプレートファイルは以下の 2 つを名前付きエクスポートする:

- `templateName` (string): マッチするテンプレート名 (例: `"基礎情報 国"`)
- `build(template)` (function): パース済みテンプレートオブジェクトを受け取り、表示モデルを返す

#### テンプレート表示モデルの型

現在サポートする表示モデルは 2 種類:

- **infobox**: サイドバーに表示されるキー・バリュー形式のテーブル
    - `{ type: "infobox", heading, rows: [{ label, value }], image? }`
    - `value` 内の wikilink は `article-page-model.js` でセグメントに解決される
- **notice**: 記事ヘッダー直下に表示されるバナー
    - `{ type: "notice", style, text }`

#### データフロー

1. **ビルド時**: `generate-content-data.mjs` が `loadTemplateHandlers(templatesDir)` でハンドラを自動検出し、Map に格納する
2. **ビルド時**: `buildArticleRecord()` がテンプレート抽出結果にハンドラを適用し、`templateModels` 配列を生成する
3. **ブラウザ時**: `buildArticlePageModel()` が infobox の `value` 内 wikilink をセグメントに解決する
4. **ブラウザ時**: `renderers.js` がセグメント解決済みモデルを HTML に変換する

#### 新規テンプレートの追加方法

新しいテンプレート類型 (infobox / notice) に当てはまる場合:

1. `src/lib/templates/` に新しい `.js` ファイルを作成する
2. `templateName` と `build()` をエクスポートする
3. ビルドを再実行する — 自動的に認識される

新しい表示モデル型が必要な場合:

1. `renderers.js` に描画関数を追加する
2. `article-page-model.js` に必要なデータ変換を追加する
3. `styles.css` にスタイルを追加する

### 3.5 Data

- `src/data/generated/content-data.js`
    - `generate-content-data.mjs` が生成する記事レコード配列と付帯情報
    - 手編集の対象にしない
- `src/data/articles.js`
    - `generated/content-data.js` を re-export する薄いラッパー
- `src/data/site-config.js`
    - カテゴリ定義、参加導線、プロセス手順、実装メモなど固定的なUI設定

### 3.6 Model

UI に依存しない純粋なデータ変換・集計処理。Node の組み込みテストから直接検証する。

- `src/lib/home-page-model.js`
    - 日付ソート・選り抜き記事選定・ランダム選択
    - キーワード検索 (タイトル・summary・tags・sections 全文)
    - カテゴリ件数集計
    - ホームページ表示用モデル組み立て
- `src/lib/article-page-model.js`
    - 参照インデックス構築 (タイトル + alias → entryId)
    - リンク解決 (一意解決 / 曖昧 / 未作成 の三分岐)
    - Wiki グラフ構築 (バックリンク・未作成記事・曖昧さ回避ページ)
    - 本文内 wikilink のセグメント分割 (テキスト / 解決済みリンク / 赤リンク / 曖昧リンク)
    - レーベンシュタイン距離による近似ページ提案
    - ハッシュルーティング解析 (`#!article/...`, `#!missing/...`, `#!disambiguation/...`)

### 3.7 View (`src/lib/renderers.js`)

HTML 文字列を返す描画関数群。DOM 操作は含まない。

- HTML エスケープ
- インライン Markdown → HTML 変換 (`**太字**` → `<strong>`, `*斜体*` → `<em>`, `` `code` `` → `<code>`, MediaWiki `'''太字'''` / `''斜体''` 対応)
- インライン `<br>` → 改行保持
- ホームページ用: 選り抜き記事カード、プレビューカード、新着リスト、更新リスト、検索結果、カテゴリカード
- 記事詳細ページ: パンくず、ヘッダー、本文セクション (wikilink セグメント描画 + インライン書式)、サイドバー (タグ・別名・バックリンク・リンク状況)
- テーブル描画: 構造化テーブルオブジェクト → `<table>` (caption, thead, tbody, th/td, rowspan/colspan 対応)
- 脚注描画: 本文中の脚注番号リンクと記事末尾の脚注リスト
- 引用描画: `<blockquote>` ブロック
- テンプレート描画: インフォボックス (サイドバー) / ノーティス (ヘッダー直下)
- 未作成記事ページ: 参照元一覧、原稿作成の案内、近似候補
- 曖昧さ回避ページ: 候補一覧、参照元
- 404 ページ

### 3.8 Bootstrap (`src/main.js`)

ブラウザ側のエントリポイント。モデルとレンダラを組み合わせて画面を駆動する。

- 初期描画 (ホームページ全セクション)
- ハッシュルーティングによる画面切り替え (home / article / missing / disambiguation)
- 検索フォーム (submit + input イベント)
- おまかせ表示ボタン (ランダム記事選択)
- セクションアンカーへのスクロール

## 4. 現在の動作形態と制約

### 4.1 SPA 構成

現在は Single Page Application として動作する。

- 全記事データを `content-data.js` という 1 つの JS ファイルに格納し、ブラウザで読み込む
- ルーティングはハッシュ (`#!article/...`) で行う
- Wiki グラフ (バックリンク・リンク解決) はクライアント側でリアルタイムに計算する
- 記事ごとの個別 HTML は生成しない

### 4.2 この構成の制約

- **スケーラビリティ**: 記事数が増えると `content-data.js` が肥大化し、初回ロードが重くなる
- **SEO**: ハッシュルーティングはクローラーに不利。OGP メタタグも記事ごとに設定できない
- **直リンク**: `#!article/...` 形式の URL は共有時に不安定になりやすい
- **ビルド成果物**: バックリンクや未解決リンクの一覧をビルド成果物として出力していない

仕様 (spec.md 8.8) では「原稿から生成された HTML を正とする」と明記されており、最終的には記事ごとの静的 HTML 生成に移行する必要がある。

### 4.3 build:site の現状

`build-site.mjs` は `index.html` と `src/` を `dist/` にコピーするだけの簡易実装。バンドル、ミニファイ、HTML 生成は行わない。GitHub Pages に載るのは開発時と同じファイル構成。

## 5. CI/CD

- `.github/workflows/deploy-pages.yml`
    - トリガー: `main` への push、または手動実行
    - ステップ: checkout (全履歴) → Node.js セットアップ → テスト → `build:site` → Pages デプロイ
    - `fetch-depth: 0` で Git 履歴を省略せずに取得する (日付生成に `git log --follow` を使うため)

## 6. 自動テスト方針

- テストランナーは Node 組み込みの `node --test` を利用する
- 対象はまず純粋関数に限定する

### 6.1 テスト済み

- `tests/home-page-model.test.js`: 日付フォーマット、ソート、選り抜き、ランダム、検索、カテゴリ集計、モデル組立
- `tests/renderers.test.js`: HTML エスケープ、各描画関数の出力検証 (XSS 回避含む)、インライン Markdown 変換、外部リンク、safe HTML タグ、リスト描画、画像埋め込み、callout、インフォボックス描画、ノーティス描画、テンプレートモデル描画
- `tests/content-import.test.js`: frontmatter パース、テンプレート抽出、セクション分割、記事レコード生成、テンプレートハンドラ統合、callout 抽出、インライン書式保持
- `tests/article-page-model.test.js`: Wiki グラフ構築、リンク解決、曖昧さ回避、セグメント分割、埋め込みセグメント、ルーティング解析、テンプレートモデル内 wikilink 解決

### 6.2 テスト未整備

ブラウザ DOM 全体の統合テストは、画面数と状態遷移が増えてから導入する。

## 7. アーカイブ方針

- `archive/prototypes/simple/`
    - 直前までルートで動いていた簡素版試作
- `archive/prototypes/ornate/`
    - 装飾強めの旧案

以後はこの配下を本実装の編集対象とみなさない。
必要に応じて比較参照は行うが、動作の基準は `src/` 側を正とする。

## 8. 次の実装段階

以下は仕様で定義されているが未実装の項目を、依存関係順に並べたもの。

### Phase 1: 記事表示の完成

1. ~~**content-import.js / article-page-model.js のテスト追加**~~ — 実装済み (59 テスト)
2. ~~**Markdown インライン書式の HTML レンダリング**~~ — 実装済み
3. ~~**テンプレートプラグイン方式**~~ — 実装済み (`基礎情報 国`, `架空`)
4. ~~**画像・埋め込みの解決**~~ — 実装済み (`![[画像.png]]` → `<img>`)
5. ~~**callout 記法の表示**~~ — 実装済み (`> [!note]` 等)
6. ~~**ブロックレベル書式 (リスト・外部リンク)**~~ — 実装済み
7. ~~**複数拡張子対応**~~ — 実装済み (`.md`/`.wiki`/`.txt`)
8. **MediaWiki 見出し記法** — `== H2 ==` 形式を Markdown 見出しと同列に処理する
9. **MediaWiki テーブル** — `{| ... |}` を構造化テーブルオブジェクトとしてパース・描画する
10. **MediaWiki 箇条書き** — `*` / `#` リスト記法を取り込む
11. **`<ref>` 脚注** — 本文中の脚注参照番号と記事末尾の脚注リスト
12. **`<blockquote>` 引用** — ブロック引用の構造化パース・描画
13. **`<br>` 改行** — インライン改行の保持
14. **`[[ファイル:...]]` 画像** — MediaWiki 画像記法の取り込み
15. **`[[Category:...]]` カテゴリ** — カテゴリタグを tags に変換
16. **`{{main|...}}` テンプレート** — 「主要記事」リンクのテンプレートハンドラ

### Phase 2: ナビゲーション強化

1. **目次の自動生成** — 記事内の見出しからサイドバーまたは本文先頭に TOC を描画する
2. **カテゴリ一覧ページ** — カテゴリカードのクリックで記事一覧を表示する
3. **タグフィルタリング** — タグによる絞り込みを実装する

### Phase 3: 静的サイト生成への移行

1. **記事ごとの HTML 生成** — SPA から SSG (Static Site Generation) へ移行する
2. **ビルド成果物の出力** — backlinks.json, missing-pages.json, redirects.json, disambiguation.json, history.json
3. **build:site の拡充** — バンドル、ミニファイ、OGP メタタグ注入、サイトマップ生成

### Phase 4: 運用基盤

2. **Obsidian 運用ガイド作成** — 執筆者向けセットアップガイド
3. **ページ履歴表示** — Git 履歴からの更新履歴一覧と GitHub へのリンク
4. **管理者向け保守レポート** — 孤立ページ、行き止まりページ、未解決リンク一覧、リンク密度
