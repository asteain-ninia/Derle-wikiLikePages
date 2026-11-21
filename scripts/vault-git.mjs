// 保管庫 (正本) の git から、原稿の履歴と昔の版を読む。
// 記事をコミットする場所は保管庫だけで、このリポジトリは content/ を git に入れない。
// 保管庫が未設定・git でないときは null や空を返し、呼ぶ側はファイルの日付で代用する。
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import { resolveVaultPath } from "./sync-vault.mjs";

function git(vaultPath, args) {
  // core.quotepath=false: 日本語のファイル名を 8 進数の並びにせず、そのまま出させる
  return execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: vaultPath,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

// 保管庫が git のリポジトリならその場所、そうでなければ null
export async function resolveVaultRepository() {
  let vaultPath;
  try {
    vaultPath = await resolveVaultPath();
  } catch {
    return null;
  }
  if (!existsSync(vaultPath)) {
    return null;
  }
  try {
    git(vaultPath, ["rev-parse", "--git-dir"]);
    return vaultPath;
  } catch {
    return null;
  }
}

const COMMIT_LINE_PREFIX = "\u0001";

// git log --name-only の出力を { hash, date, message, path } の並び (新しい順) にする。
// path はそのコミットの時点でのファイルの場所 (名前を変える前の版は昔の名前になる)
export function parseCommitLog(output) {
  const commits = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith(COMMIT_LINE_PREFIX)) {
      const [hash, date, ...messageParts] = line.slice(COMMIT_LINE_PREFIX.length).split("\t");
      commits.push({ hash, date, message: messageParts.join("\t"), path: "" });
    } else if (line.trim() && commits.length > 0 && !commits.at(-1).path) {
      commits.at(-1).path = line;
    }
  }
  return commits;
}

// 原稿 (保管庫からの相対パス) に触れたコミット。新しい順
export function getVaultCommits(vaultPath, relativePath) {
  if (!vaultPath) {
    return [];
  }
  try {
    return parseCommitLog(
      git(vaultPath, [
        "log",
        "--follow",
        "--name-only",
        `--format=${COMMIT_LINE_PREFIX}%H%x09%cs%x09%s`,
        "--",
        relativePath,
      ])
    );
  } catch {
    return [];
  }
}

// あるコミットの時点の原稿の中身。読めなければ null
export function readVaultFileAt(vaultPath, hash, relativePath) {
  try {
    return git(vaultPath, ["show", `${hash}:${relativePath}`]);
  } catch {
    return null;
  }
}
