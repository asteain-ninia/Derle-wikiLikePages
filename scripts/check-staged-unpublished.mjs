// pre-commit フックから呼ばれる。非公開の原稿 (未査読・種別: メタ・公開: false) が
// ステージされていたらコミットを止める。.git/info/exclude をすり抜けた場合の最後の砦。
import { execFileSync } from "node:child_process";

import { getUnpublishedReason } from "../src/lib/content-import.js";

const CONTENT_FILE = /^content\/.+\.(md|wiki|txt)$/i;

function git(args) {
  return execFileSync("git", ["-c", "core.quotepath=false", ...args], { encoding: "utf8" });
}

const stagedPaths = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"])
  .split("\0")
  .filter((stagedPath) => CONTENT_FILE.test(stagedPath));

const blocked = stagedPaths
  .map((stagedPath) => ({ stagedPath, reason: getUnpublishedReason(git(["show", `:${stagedPath}`])) }))
  .filter(({ reason }) => reason);

if (blocked.length > 0) {
  console.error("非公開の原稿がステージされているため、コミットを中止しました。");
  for (const { stagedPath, reason } of blocked) {
    console.error(`  ${stagedPath} (${reason})`);
  }
  console.error("公開する場合は原稿の該当箇所を外してから、ステージし直してください。");
  console.error('取り消すには: git restore --staged -- "<パス>"');
  process.exit(1);
}
