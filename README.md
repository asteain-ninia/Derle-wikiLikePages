# Derle-wikiLikePages

GitHub Pages で公開しつつ、Wikiライクな執筆体験は外部エディタへ委譲する個人用の Wiki 基盤です。

[WikiLikePages](https://github.com/asteain-ninia/WikiLikePages) を一人で執筆・公開する前提でフォークしたもので、投稿経路やレビューの仕組みは持ちません。原稿の正本は手元の Obsidian 保管庫で、公開する記事だけを `npm run sync` で `content/` にコピーし、`main` へ直接 push すると GitHub Pages へ自動デプロイされます。

2026-03-17 に試作品を `archive/prototypes/` へ隔離し、ルート配下は正式実装の着手点へ切り替えました。

## 現在の構成

- 公開する原稿と画像: `content/` (保管庫から `npm run sync` で生成。直接編集しない)
- 画面本体: `index.html`
- 実装コード: `src/`
- 設計資料: `docs/`
- 試作品アーカイブ: `archive/prototypes/`
- 自動テスト: `tests/`

## 保管庫との同期

- リポジトリ直下に `local.config.json` (git 管理外) を作り、保管庫の場所を書きます: `{ "vaultPath": "C:/Users/…/Obsidian" }` (環境変数 `DERLE_VAULT` でも可)
- `npm run sync` で、frontmatter に `公開: true` がある原稿と、それらが名前を書いている画像だけを `content/` にコピーします。保管庫に無いもの・公開をやめたものは `content/` から消えます
- frontmatter は単純な形 (`キー: 値` と `- 項目`) だけを解釈し、読めない形式の原稿は公開しません (名前を表示します)

## 実行メモ

- トップページは ES Modules を使っているため、`file://` ではなく `npm run dev` (`npm run serve` も同じ) で HTTP 経由起動します
- 既定の起動先は `http://localhost:4173` です。待ち受けはこの PC のみ (`127.0.0.1`) で、`HOST` / `PORT` 環境変数で変えられます
- 開発サーバーは保管庫 (設定されていれば)・`content/`・`src/lib/templates/` を監視しており、原稿を保存すると自動で同期と `build:content` を実行してブラウザを再読み込みします
- サーバーを使わずに原稿を画面データへ反映するには `npm run build:content` を実行します
- Pages に載せる公開物は `npm run build:site` で `dist/` へ出力します
- 自動テストは `npm test` で実行できます

## GitHub Pages

- デプロイ用ワークフローは [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) です
- `main` への push または手動実行で、テスト後に `build:site` を走らせて GitHub Pages へデプロイします
- リポジトリの `Settings > Pages` で `Source` を `GitHub Actions` に切り替えてください
- 原稿の日付生成で `git log --follow` を使うため、Actions の checkout は履歴を省略しない設定にしています

## ドキュメント

- 仕様たたき台: [docs/spec.md](docs/spec.md)
- 実装アーキテクチャ: [docs/implementation-architecture.md](docs/implementation-architecture.md)
