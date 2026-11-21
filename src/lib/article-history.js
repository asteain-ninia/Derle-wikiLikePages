// 記事の更新履歴 (保管庫の git のコミット) を整える。
// コミットの文言は Wikipedia の編集履歴の要約として使う。保管庫でその記事に触れたコミットは
// すべて履歴に載る。載せたくないコミット (公開: true の付与、一括の機械的な整理など) は、
// 文言を「chore: …」のようにコードの作業の接頭辞で始める。
// 「wiki: 脱字の修正」の wiki: は、このリポジトリで content/ をコミットしていた頃の印で、あれば外す。

const WIKI_COMMIT_PATTERN = /^wiki:\s*/i;
const HIDDEN_COMMIT_PATTERN =
  /^(feat|fix|refactor|chore|docs|test|tests|style|ci|build|perf|revert|merge|content)(\([^)]*\))?!?:/i;

// 古い版のページの URL に使うコミットの短い名前
export const REVISION_ID_LENGTH = 10;

export function toRevisionId(hash) {
  return String(hash ?? "").slice(0, REVISION_ID_LENGTH);
}

// 履歴に載せるなら画面に出す文言を、載せないなら null を返す
export function toHistoryMessage({ message }) {
  const subject = String(message ?? "").trim();

  if (WIKI_COMMIT_PATTERN.test(subject)) {
    return subject.replace(WIKI_COMMIT_PATTERN, "").trim() || null;
  }

  if (!subject || HIDDEN_COMMIT_PATTERN.test(subject)) {
    return null;
  }

  return subject;
}

// commits は新しい順の { date, message, hash }。
// - history: 履歴に載るコミット (文言は接頭辞を外したもの)。hash があれば revision に短い名前
// - created: いちばん古いコミットの日付 (載らないコミットも含めた全体から取る)
// - updated: 履歴に載るコミットの最新の日付。1 件も無ければ作成日
export function summarizeArticleHistory(commits) {
  if (!commits || commits.length === 0) {
    return null;
  }

  const history = commits
    .map((commit) => {
      const entry = { date: commit.date, message: toHistoryMessage(commit) };
      if (commit.hash) {
        entry.revision = toRevisionId(commit.hash);
      }
      return entry;
    })
    .filter((commit) => commit.message !== null);
  const created = commits[commits.length - 1].date;

  return {
    created,
    updated: history[0]?.date ?? created,
    history,
  };
}
