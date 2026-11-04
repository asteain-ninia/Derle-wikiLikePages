// 記事の更新履歴 (git のコミット) を整える。
// コミットの文言は Wikipedia の編集履歴の要約として使う。履歴に載せるのは、記事の編集として
// 「wiki: 脱字の修正」のように専用の接頭辞を付けたコミットだけ (公開: true と同じオプトイン)。
// 画面には接頭辞を外して「脱字の修正」と出す。
// 例外として、このリポジトリにフォークする前 (保管庫で git を使っていた頃) のコミットは
// 接頭辞が無くても載せる。ただしコードの作業のコミット (feat: / fix: など) は除く。

export const WIKI_COMMIT_PREFIX = "wiki:";
// フォークして保管庫の履歴を統合した日。これより前のコミットは保管庫時代のもの
export const VAULT_ERA_END = "2026-10-17";

const WIKI_COMMIT_PATTERN = /^wiki:\s*/i;
const CODE_COMMIT_PATTERN =
  /^(feat|fix|refactor|chore|docs|test|tests|style|ci|build|perf|revert|merge|content)(\([^)]*\))?!?:/i;

// 履歴に載せるなら画面に出す文言を、載せないなら null を返す
export function toHistoryMessage({ date, message }) {
  const subject = String(message ?? "").trim();

  if (WIKI_COMMIT_PATTERN.test(subject)) {
    return subject.replace(WIKI_COMMIT_PATTERN, "").trim() || null;
  }

  if (String(date) < VAULT_ERA_END && subject && !CODE_COMMIT_PATTERN.test(subject)) {
    return subject;
  }

  return null;
}

// commits は新しい順の { date, message }。
// - history: 履歴に載るコミット (文言は接頭辞を外したもの)
// - created: いちばん古いコミットの日付 (載らないコミットも含めた全体から取る)
// - updated: 履歴に載るコミットの最新の日付。1 件も無ければ作成日
export function summarizeArticleHistory(commits) {
  if (!commits || commits.length === 0) {
    return null;
  }

  const history = commits
    .map((commit) => ({ date: commit.date, message: toHistoryMessage(commit) }))
    .filter((commit) => commit.message !== null);
  const created = commits[commits.length - 1].date;

  return {
    created,
    updated: history[0]?.date ?? created,
    history,
  };
}
