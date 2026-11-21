# 出界百科の使い方

記事を書いて公開するまでの手順と、困ったときの見どころをまとめたもの (2026-11-22 時点)。
仕組みの図は [pipeline-next.html](pipeline-next.html)、移行の経緯は [pipeline.html](pipeline.html) にある。

## ふだんの流れ

1. Obsidian で保管庫「出界百科」の記事を書く。
2. 保管庫でコミットする。文言がそのまま記事の更新履歴 (編集要約) になる。
3. 保管庫を push する。

これだけで、1 分ほどで <https://asteain-ninia.github.io/Derle-wikiLikePages/> に出る。
このリポジトリ (Derle-wikiLikePages) での操作は要らない。

```
cd "C:/Users/…/OneDrive/ドキュメント/出界百科"
git add -A
git commit -m "ジンとの関連について追記"
git push
```

## 記事を公開する・取り下げる

| したいこと | やること |
| --- | --- |
| 記事を公開する | 記事の先頭の frontmatter に `公開: true` を書く |
| 公開をやめる | `公開: true` を消す (または `公開: false` にする)。次のデプロイで記事も古い版のページも消える |
| 画像を出す | 公開する記事の中に画像のファイル名を書く (`![[地図.png]]` など)。どの公開記事にも名前が無い画像は出ない |
| 記事の名前を変える | Obsidian でファイル名を変える。履歴は引き継がれるが、記事の URL は変わる (古い URL からの転送は無い) |

frontmatter は `キー: 値` と `- 項目` の単純な形だけを読む。読めない形の記事は、`公開: true` と書いてあっても出さない。

## 更新履歴に載るもの・載らないもの

- 保管庫でその記事に触れたコミットは、全部その記事の更新履歴に載る。公開する前のコミットも載る。
- 載せたくないコミットは、文言を `chore:` で始める。`公開: true` を付けるだけのコミットや、機械的な一括の整理に使う。
  例: `chore: 公開する記事に 公開: true を付ける`
- 記事の「作成」日は最初のコミットの日、「更新」日は履歴に載るコミットのうち最新の日。`chore:` のコミットでは更新日は動かない。
- 1 つのコミットで複数の記事を変えると、同じ文言がそれぞれの記事の履歴に載る。

## 古い版

- 履歴の文言を押すと、その時点の版のページが開く (`article/<記事>/rev/<版>/`)。上部に「○年○月○日時点の古い版です」と最新の版へのリンクが出る。
- 公開する前の版も読める。
- 古い版のページは検索に載せない (`noindex`、sitemap にも入れない)。
- 昔の版にしか使われていない画像は表示されない。

## 出す前に手元で確かめる

このリポジトリで次を実行し、<http://localhost:4173> を開く。

```
npm run dev
```

- 保管庫を見張っていて、記事を保存するたびに作り直してブラウザを再読み込みする。コミットしていない内容もそのまま見える。
- 保管庫の場所は、リポジトリ直下の `local.config.json` に書く (PC ごと。git には入らない)。
  `{ "vaultPath": "C:/Users/…/OneDrive/ドキュメント/出界百科" }`
- 手元の `content/` と `.generated/` は自動で作られる生成物。編集もコミットもしない。

## 数値と計算機 (出界の織機)

記事の中に `{{織機|量|単位|有効数字}}` と書くと、ビルドのときに計算値に置き換わる。
`{{計算機|単位}}` や `{{計算機|時刻}}` の行は、読者が数字を入れられる計算機になる。
量と単位の名前は [loom.md](loom.md) にある。

## デプロイの様子を見る・手で動かす

```
gh run list -R asteain-ninia/Derle-wikiLikePages --limit 3     # 最近のデプロイ
gh run view <番号> -R asteain-ninia/Derle-wikiLikePages --log-failed   # 失敗したときの記録
gh workflow run deploy-pages.yml -R asteain-ninia/Derle-wikiLikePages  # 手でデプロイする
```

デプロイが始まるきっかけは 3 つある。保管庫の push、このリポジトリの `main` への push (コードを変えたとき)、手での実行。

## うまくいかないとき

| 起きたこと | 見るところ |
| --- | --- |
| push したのに記事が出ない | 記事に `公開: true` があるか。`gh run list` でデプロイが成功しているか。成功していれば、ブラウザの再読み込みを試す |
| push してもデプロイが始まらない | `gh run list -R asteain-ninia/derle-vault --limit 1` で「Notify site」が動いたか。動いていて警告が出ていれば、トークン (下の表) が切れている |
| デプロイが「Checkout vault」で失敗する | 保管庫を読む鍵 (下の表) が消えたか、保管庫のリポジトリ名が変わった |
| デプロイが「Run tests」や「Build static site」で失敗する | コードか原稿の問題。`--log-failed` の記録で、止まった場所とエラーの文言を見る |
| 履歴に出したくないコミットが出た | そのコミットの文言を `chore:` で始まるように直す。push 済みのコミットの文言を直すと履歴の書き換えになるので、次からそうする、でもよい |
| 画像が出ない | 公開している記事の本文かインフォボックスに、その画像のファイル名が書かれているか |

## 2 台の PC で使うとき

- 保管庫は OneDrive で同期され、`.git` も一緒に同期される。**2 台で同時に保管庫の git を使わない。** もう 1 台で作業する前に、OneDrive の同期が終わるのを待つ。
- `.obsidian/workspace*.json` (開いているタブなどの状態) は git に入れていない。2 台で Obsidian を開いたままにすると、OneDrive が `workspace-PC名-番号.json` という競合コピーを作ることがある。消して構わない。
- このリポジトリは PC ごとに `git pull` する。`local.config.json` も PC ごとに置く。

## 新しい PC で始めるとき

1. OneDrive の同期で保管庫「出界百科」が届くのを待ち、Obsidian で開く。
2. このリポジトリを clone する。Node.js が要る (Actions は 24 を使っている)。追加で入れるパッケージは無い。
3. リポジトリ直下に `local.config.json` を作り、保管庫の場所を書く。
4. `npm run dev` で表示を確かめる。
5. `gh auth login` で GitHub にログインする (push と `gh` のコマンドに要る)。

## 鍵とトークン

| 名前 | 置き場所 | 役目 | 期限 |
| --- | --- | --- | --- |
| `VAULT_DEPLOY_KEY` | Derle-wikiLikePages の secret。対になる公開鍵は derle-vault の Deploy keys「Derle-wikiLikePages Actions (read-only)」 | Actions が非公開の保管庫を読む。読み取り専用 | なし |
| `SITE_DISPATCH_TOKEN` | derle-vault の secret。中身は GitHub の fine-grained トークン「derle-vault notify」 | 保管庫の push をきっかけに、このリポジトリの Actions を起こす。届くのは Derle-wikiLikePages の Contents だけ | なし |

作り直すときは次のとおり。

- **トークン**: GitHub の Settings → Developer settings → Personal access tokens → Fine-grained tokens で「derle-vault notify」を Regenerate し、`gh secret set SITE_DISPATCH_TOKEN -R asteain-ninia/derle-vault` で貼り直す。
- **鍵**: `ssh-keygen -t ed25519` で作り、公開鍵を `gh repo deploy-key add <公開鍵> -R asteain-ninia/derle-vault`、秘密鍵を `gh secret set VAULT_DEPLOY_KEY -R asteain-ninia/Derle-wikiLikePages < <秘密鍵>` で登録して、手元のファイルを消す。

## 控え

- 保管庫の履歴は GitHub の非公開リポジトリ `asteain-ninia/derle-vault` に全部ある。保管庫の `.git` が壊れたら、直そうとせずにここから取り直す。
- 2026-11-21 に履歴を並べ直す前の状態は、ノート PC の `C:\Users\tatuk\vault-backup\Obsidian-vault-2026-11-21-pre-restack.bundle` と、保管庫の `refs/backup/pre-restack-2026-11-21` に残してある。
