import test from "node:test";
import assert from "node:assert/strict";

import { summarizeArticleHistory, toHistoryMessage } from "../src/lib/article-history.js";

test("toHistoryMessage は wiki: のコミットだけを載せ、接頭辞を外す", () => {
  assert.equal(toHistoryMessage({ date: "2026-11-05", message: "wiki: 脱字の修正" }), "脱字の修正");
  assert.equal(toHistoryMessage({ date: "2026-11-05", message: "WIKI:一括名称変更 旧名→新名" }), "一括名称変更 旧名→新名");
  assert.equal(toHistoryMessage({ date: "2026-11-05", message: "脱字の修正" }), null);
  assert.equal(toHistoryMessage({ date: "2026-11-05", message: "content: 外部リンクを直す" }), null);
  assert.equal(toHistoryMessage({ date: "2026-11-05", message: "wiki:" }), null);
});

test("toHistoryMessage は保管庫時代 (2026-10-17 より前) のコミットを接頭辞なしでも載せるが、コードの作業は除く", () => {
  assert.equal(toHistoryMessage({ date: "2026-06-05", message: "リンク整理: 散文内の重複リンクを初出のみに" }), "リンク整理: 散文内の重複リンクを初出のみに");
  assert.equal(toHistoryMessage({ date: "2026-03-22", message: "feat:手動コミット" }), null);
  assert.equal(toHistoryMessage({ date: "2026-10-17", message: "refactor: 保管庫を OneDrive の正本に戻す" }), null);
  assert.equal(toHistoryMessage({ date: "2026-10-17", message: "記事を足す" }), null);
});

test("summarizeArticleHistory は作成日を全体から、更新日を履歴に載るコミットから取る", () => {
  const summary = summarizeArticleHistory([
    { date: "2026-11-02", message: "feat: コードの作業" },
    { date: "2026-11-01", message: "wiki: 脱字の修正" },
    { date: "2026-10-17", message: "refactor: 作り直し" },
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
  assert.deepEqual(summarizeArticleHistory([{ date: "2026-11-02", message: "feat: 追加" }]), {
    created: "2026-11-02",
    updated: "2026-11-02",
    history: [],
  });
  assert.equal(summarizeArticleHistory([]), null);
});
