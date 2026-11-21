import test from "node:test";
import assert from "node:assert/strict";

import { summarizeArticleHistory, toHistoryMessage, toRevisionId } from "../src/lib/article-history.js";
import { parseCommitLog } from "../scripts/vault-git.mjs";

test("toHistoryMessage は保管庫のコミットを接頭辞なしで載せ、wiki: は外す", () => {
  assert.equal(toHistoryMessage({ message: "脱字の修正" }), "脱字の修正");
  assert.equal(toHistoryMessage({ message: "リンク整理: 散文内の重複リンクを初出のみに" }), "リンク整理: 散文内の重複リンクを初出のみに");
  assert.equal(toHistoryMessage({ message: "wiki: 脱字の修正" }), "脱字の修正");
  assert.equal(toHistoryMessage({ message: "WIKI:一括名称変更 旧名→新名" }), "一括名称変更 旧名→新名");
  assert.equal(toHistoryMessage({ message: "wiki:" }), null);
  assert.equal(toHistoryMessage({ message: "" }), null);
});

test("toHistoryMessage は chore: などコードの作業の接頭辞で始まるコミットを載せない", () => {
  assert.equal(toHistoryMessage({ message: "chore: 公開する記事に 公開: true を付ける" }), null);
  assert.equal(toHistoryMessage({ message: "feat:手動コミット" }), null);
  assert.equal(toHistoryMessage({ message: "refactor(vault): 置き場所を変える" }), null);
  assert.equal(toHistoryMessage({ message: "content: 外部リンクを直す" }), null);
});

test("summarizeArticleHistory は作成日を全体から、更新日を履歴に載るコミットから取る", () => {
  const summary = summarizeArticleHistory([
    { date: "2026-11-02", message: "chore: 公開: true を付ける" },
    { date: "2026-11-01", message: "脱字の修正" },
    { date: "2026-06-05", message: "インフォボックスを展開" },
    { date: "2026-05-02", message: "ログのためgit化" },
  ]);

  assert.deepEqual(summary, {
    created: "2026-05-02",
    updated: "2026-11-01",
    history: [
      { date: "2026-11-01", message: "脱字の修正" },
      { date: "2026-06-05", message: "インフォボックスを展開" },
      { date: "2026-05-02", message: "ログのためgit化" },
    ],
  });
});

test("summarizeArticleHistory は履歴に載るコミットが無ければ更新日を作成日にする", () => {
  assert.deepEqual(summarizeArticleHistory([{ date: "2026-11-02", message: "chore: 追加" }]), {
    created: "2026-11-02",
    updated: "2026-11-02",
    history: [],
  });
  assert.equal(summarizeArticleHistory([]), null);
});

test("summarizeArticleHistory は hash があれば古い版のページに使う短い名前を付ける", () => {
  const commits = [
    { hash: "aaa1111111222222", date: "2026-11-02", message: "chore: 作業" },
    { hash: "bbb2222222333333", date: "2026-11-01", message: "脱字の修正" },
  ];
  assert.deepEqual(summarizeArticleHistory(commits).history, [
    { date: "2026-11-01", message: "脱字の修正", revision: "bbb2222222" },
  ]);
  assert.equal(toRevisionId("bbb2222222333333"), "bbb2222222");
});

test("parseCommitLog は git log --name-only の出力から、コミットごとのファイルの場所と日本時間の日付を読む", () => {
  const output = [
    // 2026-11-04T15:30:00Z = 日本時間 11-05 の 0 時半 (UTC では前の日)
    "\u0001aaa111\t1793806200\t脱字の修正",
    "",
    "国/新しい名前.md",
    "\u0001bbb222\t1780628400\tタブ\tを含む文言",
    "",
    "国/昔の名前.md",
    "",
  ].join("\n");

  assert.deepEqual(parseCommitLog(output), [
    { hash: "aaa111", date: "2026-11-05", message: "脱字の修正", path: "国/新しい名前.md" },
    { hash: "bbb222", date: "2026-06-05", message: "タブ\tを含む文言", path: "国/昔の名前.md" },
  ]);
  assert.deepEqual(parseCommitLog(""), []);
});
