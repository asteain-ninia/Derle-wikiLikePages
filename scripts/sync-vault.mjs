// Obsidian 保管庫 (正本) から、公開する原稿と画像だけを content/ にコピーする。
// content/ は保管庫から生成されるミラーで、保管庫に無いもの・公開をやめたものは消える。
//
// 保管庫の場所は環境変数 DERLE_VAULT か、リポジトリ直下の local.config.json
// ({ "vaultPath": "C:/Users/…/Obsidian" }、git 管理外) で指定する。
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IMAGE_FILE, NOTE_FILE, selectPublishedFiles } from "../src/lib/vault-sync.js";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const contentRoot = path.join(projectRoot, "content");
const localConfigPath = path.join(projectRoot, "local.config.json");

export async function resolveVaultPath() {
  if (process.env.DERLE_VAULT) {
    return path.resolve(process.env.DERLE_VAULT);
  }

  if (existsSync(localConfigPath)) {
    const { vaultPath } = JSON.parse(await readFile(localConfigPath, "utf8"));
    if (vaultPath) {
      return path.resolve(vaultPath);
    }
  }

  throw new Error(
    "保管庫の場所が設定されていません。リポジトリ直下に local.config.json を作り、\n" +
      '  { "vaultPath": "C:/Users/…/Obsidian" }\n' +
      "のように書くか、環境変数 DERLE_VAULT で指定してください。"
  );
}

// ドットで始まるファイル・フォルダ (.obsidian, .git など) を除いた全ファイル (相対パス、区切りは /)
async function listFiles(rootPath, relativeDir = "") {
  const entries = await readdir(path.join(rootPath, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(rootPath, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

async function removeEmptyDirectories(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirectories(path.join(directoryPath, entry.name));
    }
  }

  if (directoryPath !== contentRoot && (await readdir(directoryPath)).length === 0) {
    await rmdir(directoryPath);
  }
}

async function filesEqual(leftPath, rightPath) {
  if (!existsSync(rightPath)) {
    return false;
  }
  const [left, right] = await Promise.all([readFile(leftPath), readFile(rightPath)]);
  return left.equals(right);
}

export async function syncVault({ log = console.log } = {}) {
  const vaultPath = await resolveVaultPath();
  if (!existsSync(vaultPath)) {
    throw new Error(`保管庫が見つかりません: ${vaultPath}`);
  }
  if (!path.relative(projectRoot, vaultPath).startsWith("..")) {
    throw new Error(`保管庫がリポジトリの中を指しています: ${vaultPath}`);
  }

  const vaultFiles = await listFiles(vaultPath);
  const notes = await Promise.all(
    vaultFiles
      .filter((filePath) => NOTE_FILE.test(filePath))
      .map(async (filePath) => ({ path: filePath, text: await readFile(path.join(vaultPath, filePath), "utf8") }))
  );
  const imagePaths = vaultFiles.filter((filePath) => IMAGE_FILE.test(filePath));
  const selection = selectPublishedFiles(notes, imagePaths);

  // 設定ミスなどで公開記事が 0 件になったときに content/ を空にしてしまわないよう止める
  if (selection.publishedNoteCount === 0) {
    throw new Error(`公開: true の原稿が保管庫に 1 件もありません (${vaultPath})。同期を中止しました。`);
  }

  await mkdir(contentRoot, { recursive: true });
  const targetFiles = new Set(selection.files);
  let copiedCount = 0;
  for (const filePath of selection.files) {
    const sourcePath = path.join(vaultPath, filePath);
    const destinationPath = path.join(contentRoot, filePath);
    if (await filesEqual(sourcePath, destinationPath)) {
      continue;
    }
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    copiedCount += 1;
  }

  const removedFiles = (await listFiles(contentRoot)).filter((filePath) => !targetFiles.has(filePath));
  for (const filePath of removedFiles) {
    await rm(path.join(contentRoot, filePath));
  }
  await removeEmptyDirectories(contentRoot);

  for (const notePath of selection.unreadableNotes) {
    log(`  frontmatter を解釈できないため公開しません: ${notePath}`);
  }
  log(
    `[sync] 公開記事 ${selection.publishedNoteCount} 件・画像 ${selection.imageCount} 件` +
      ` (更新 ${copiedCount} 件、削除 ${removedFiles.length} 件) ← ${vaultPath}`
  );

  return { ...selection, copiedCount, removedFiles };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  syncVault().catch((error) => {
    console.error(`[sync] ${error.message}`);
    process.exit(1);
  });
}
