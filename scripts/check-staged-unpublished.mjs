// pre-commit フックから呼ばれる。content/ 配下で公開しないもの
// (未査読・種別: メタ・公開: false の原稿、記事と画像以外のファイル) が
// ステージされていたらコミットを止める。.git/info/exclude をすり抜けた場合の最後の砦。
import { execFileSync } from "node:child_process";

import { getUnpublishedReason } from "../src/lib/content-import.js";

const CONTENT_FILE = /\.(md|wiki|txt)$/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg)$/i;

function git(args) {
  return execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  });
}

function getBlockReason(stagedPath) {
  // .obsidian/ などドットで始まるものは .gitignore 側の管理だが、ステージされたら止める
  if (stagedPath.split("/").some((segment) => segment.startsWith("."))) {
    return "ドットで始まるファイル・フォルダ";
  }

  if (IMAGE_FILE.test(stagedPath)) {
    return null;
  }

  if (!CONTENT_FILE.test(stagedPath)) {
    return "記事・画像以外のファイル";
  }

  return getUnpublishedReason(git(["show", `:${stagedPath}`]));
}

const stagedPaths = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .split("\0")
  .filter((stagedPath) => stagedPath.startsWith("content/"));

const blocked = stagedPaths
  .map((stagedPath) => ({ stagedPath, reason: getBlockReason(stagedPath) }))
  .filter(({ reason }) => reason);

if (blocked.length > 0) {
  console.error("公開しないファイルがステージされているため、コミットを中止しました。");
  for (const { stagedPath, reason } of blocked) {
    console.error(`  ${stagedPath} (${reason})`);
  }
  console.error("公開する原稿なら、未査読コールアウト・種別: メタ・公開: false を外してからステージし直してください。");
  console.error('取り消すには: git restore --staged -- "<パス>"');
  process.exit(1);
}
