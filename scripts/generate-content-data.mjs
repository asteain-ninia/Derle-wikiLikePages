import { mkdir, open, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildArticleRecord,
  findDuplicateEntryIds,
  checkPublication,
} from "../src/lib/content-import.js";
import { loadTemplateHandlers } from "../src/lib/template-registry.js";
import { buildBuildArtifacts } from "../src/lib/build-artifacts.js";
import { readImageSize } from "../src/lib/image-size.js";
import { summarizeArticleHistory, toHistoryMessage, toRevisionId } from "../src/lib/article-history.js";
import { getVaultCommits, readVaultFileAt, resolveVaultRepository } from "./vault-git.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(projectRoot, "content");
const templatesDir = path.join(projectRoot, "src", "lib", "templates");
const generatedDataDir = path.join(projectRoot, "src", "data", "generated");
const generatedDataPath = path.join(generatedDataDir, "content-data.js");
// 古い版の記事データ。src/ は丸ごと配信されるので、その外に置く (読むのは build:site と開発サーバーだけ)
const revisionsDir = path.join(projectRoot, ".generated");
const revisionsPath = path.join(revisionsDir, "article-revisions.json");

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function formatDate(dateLike) {
  if (typeof dateLike === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    return dateLike;
  }

  return new Date(dateLike).toISOString().slice(0, 10);
}

const CONTENT_FILE_EXTENSIONS = /\.(md|wiki|txt)$/i;
const IMAGE_FILE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

// ドットで始まるファイル・フォルダ (.obsidian など) を除いた content/ 配下の全ファイル
async function collectFiles(directoryPath) {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const collected = [];

  for (const entry of directoryEntries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (entry.isFile()) {
      collected.push(absolutePath);
    }
  }

  return collected;
}

// 履歴は保管庫 (正本) の git から読む。content/ の原稿は保管庫と同じ相対パスに置かれている
const vaultRepository = await resolveVaultRepository();
if (!vaultRepository) {
  console.log("  保管庫の git が見つからないため、更新履歴は付けず、日付はファイルのものを使います");
}

// 作成日・更新日・更新履歴 (src/lib/article-history.js)。commits は古い版のページを作るのにも使う。
// 保管庫でまだコミットされていない原稿はファイルの日付を使う
async function getFileHistory(absolutePath, vaultRelativePath) {
  const commits = getVaultCommits(vaultRepository, vaultRelativePath);
  const summary = summarizeArticleHistory(commits);
  if (summary) {
    return { ...summary, commits };
  }

  const fileStats = await stat(absolutePath);
  return {
    created: formatDate(fileStats.birthtimeMs || fileStats.ctimeMs || fileStats.mtimeMs),
    updated: formatDate(fileStats.mtimeMs),
    history: [],
    commits: [],
  };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const updatedComparison = right.updated.localeCompare(left.updated);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }

    return left.title.localeCompare(right.title, "ja-JP");
  });
}

async function buildContentData() {
  const allFiles = await collectFiles(contentRoot);
  const markdownFiles = allFiles.filter((filePath) => CONTENT_FILE_EXTENSIONS.test(filePath));
  const templateHandlers = await loadTemplateHandlers(templatesDir);
  const entries = [];
  // 記事 ID → 古い版 ({ id, date, message, record }、新しい順)
  const revisions = {};
  // content/ は npm run sync が公開する原稿だけを置く場所だが、手で置かれた原稿なども
  // 公開: true が無ければ載せない (念のための確認)
  const skippedPaths = [];

  // 画像のファイル名 → content/ からのパス (同名の画像が複数あれば先に見つかった方)
  const assetPathsByName = new Map();
  for (const filePath of allFiles.filter((candidate) => IMAGE_FILE_EXTENSIONS.test(candidate))) {
    const fileName = path.basename(filePath);
    if (!assetPathsByName.has(fileName)) {
      assetPathsByName.set(fileName, toPosixPath(path.relative(contentRoot, filePath)));
    }
  }
  const resolveAssetPath = (fileName) =>
    fileName.includes("/") ? fileName : assetPathsByName.get(fileName) ?? fileName;

  // 画像の縦横 (content/ からのパス → [幅, 高さ])。img に width / height を付け、
  // 遅延読み込みの画像が後から伸びてページの位置がずれないようにする
  const imageSizes = {};
  for (const filePath of allFiles.filter((candidate) => IMAGE_FILE_EXTENSIONS.test(candidate))) {
    const size = await readImageFileSize(filePath);
    if (size) {
      imageSizes[toPosixPath(path.relative(contentRoot, filePath))] = [size.width, size.height];
    }
  }

  for (const absolutePath of markdownFiles) {
    const relativeToContent = toPosixPath(path.relative(contentRoot, absolutePath));
    const fileBasename = path.basename(absolutePath, path.extname(absolutePath));
    const sourceText = await readFile(absolutePath, "utf8");
    if (!checkPublication(sourceText).published) {
      skippedPaths.push(relativeToContent);
      console.log(`  公開: true が無いため載せません: ${relativeToContent}`);
      continue;
    }

    const { created, updated, history, commits } = await getFileHistory(absolutePath, relativeToContent);

    const record = buildArticleRecord({
      relativePath: relativeToContent,
      fileBasename,
      sourceText,
      created,
      updated,
      templateHandlers,
      resolveAssetPath,
    });
    record.history = history;
    entries.push(record);

    // 履歴に載るコミットごとに、その時点の原稿から記事データを作る (古い版のページ用)。
    // 昔の原稿が読めない・組み立てられないときは、その版だけ飛ばす (過去の履歴は直せないので、ビルドは止めない)
    revisions[record.id] = commits
      .filter((commit) => toHistoryMessage(commit) !== null)
      .flatMap((commit) => {
        const oldSource = readVaultFileAt(vaultRepository, commit.hash, commit.path || relativeToContent);
        if (oldSource === null) {
          console.log(`  古い版を読めないため飛ばします: ${relativeToContent} @ ${toRevisionId(commit.hash)}`);
          return [];
        }
        try {
          const oldRecord = buildArticleRecord({
            relativePath: relativeToContent,
            fileBasename,
            sourceText: oldSource,
            created,
            updated: commit.date,
            templateHandlers,
            resolveAssetPath,
          });
          return [{ id: toRevisionId(commit.hash), date: commit.date, message: toHistoryMessage(commit), record: oldRecord }];
        } catch (error) {
          console.log(`  古い版を組み立てられないため飛ばします: ${relativeToContent} @ ${toRevisionId(commit.hash)} (${error.message})`);
          return [];
        }
      });
  }

  const duplicates = findDuplicateEntryIds(entries);
  if (duplicates.length > 0) {
    const details = duplicates
      .map(({ id, sourcePaths }) => `  ${id}: ${sourcePaths.join(", ")}`)
      .join("\n");
    throw new Error(
      `拡張子だけが異なる原稿が同じ記事 ID になっています。どちらか一方を削除またはリネームしてください。\n${details}`
    );
  }

  const publishedEntries = entries.filter((entry) => !entry.draft);

  return {
    contentBuildInfo: {
      totalMarkdownFiles: markdownFiles.length,
      skippedFileCount: skippedPaths.length,
      publishedArticleCount: publishedEntries.length,
      generatedAt: new Date().toISOString(),
    },
    generatedArticles: sortEntries(publishedEntries),
    imageSizes,
    revisions: Object.fromEntries(publishedEntries.map((entry) => [entry.id, revisions[entry.id] ?? []])),
  };
}

// 大きさは先頭に書かれているので、まず先頭だけ読む (JPEG で見つからなければ全体を読む)
async function readImageFileSize(filePath) {
  const handle = await open(filePath, "r");
  try {
    const head = Buffer.alloc(256 * 1024);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    const size = readImageSize(head.subarray(0, bytesRead));
    if (size || bytesRead < head.length) {
      return size;
    }
  } finally {
    await handle.close();
  }
  return readImageSize(await readFile(filePath));
}

function serializeModule({ contentBuildInfo, generatedArticles, imageSizes }) {
  return `export const contentBuildInfo = ${JSON.stringify(contentBuildInfo, null, 2)};\n\nexport const generatedArticles = ${JSON.stringify(generatedArticles, null, 2)};\n\nexport const imageSizes = ${JSON.stringify(imageSizes, null, 2)};\n`;
}

const contentData = await buildContentData();
await mkdir(generatedDataDir, { recursive: true });
await writeFile(generatedDataPath, serializeModule(contentData), "utf8");
await mkdir(revisionsDir, { recursive: true });
await writeFile(revisionsPath, JSON.stringify(contentData.revisions), "utf8");

// リンク解決結果のビルド成果物 (backlinks.json など) と管理者向け保守レポートを同じ場所に書き出す。
// src/ ごと dist/ にコピーされるので、公開サイトでも src/data/generated/*.json として読める
const { files: artifactFiles, maintenanceReport } = buildBuildArtifacts(contentData.generatedArticles, {
  generatedAt: contentData.contentBuildInfo.generatedAt,
});
for (const [fileName, content] of Object.entries(artifactFiles)) {
  const serialized = typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`;
  await writeFile(path.join(generatedDataDir, fileName), serialized, "utf8");
}

console.log(
  `Generated ${contentData.generatedArticles.length} article records at ${path.relative(projectRoot, generatedDataPath)}` +
    ` (古い版 ${Object.values(contentData.revisions).reduce((sum, list) => sum + list.length, 0)} 件)`
);
const { summary } = maintenanceReport;
console.log(
  `保守レポート: 未解決リンク ${summary.missingPageCount} 件 (${summary.missingReferenceCount} 箇所) / 孤立 ${summary.orphanCount} / 行き止まり ${summary.deadEndCount} / 曖昧 ${summary.ambiguousNameCount} → ${toPosixPath(path.relative(projectRoot, path.join(generatedDataDir, "maintenance-report.md")))}`
);
