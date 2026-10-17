import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildArticleRecord,
  findDuplicateEntryIds,
  getUnpublishedReason,
} from "../src/lib/content-import.js";
import { loadTemplateHandlers } from "../src/lib/template-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const contentRoot = path.join(projectRoot, "content");
const templatesDir = path.join(projectRoot, "src", "lib", "templates");
const generatedDataDir = path.join(projectRoot, "src", "data", "generated");
const generatedDataPath = path.join(generatedDataDir, "content-data.js");

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

function getGitDates(repoRelativePath) {
  try {
    const output = execFileSync(
      "git",
      ["log", "--follow", "--format=%cs", "--", repoRelativePath],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    const dates = output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (dates.length > 0) {
      return {
        created: dates[dates.length - 1],
        updated: dates[0],
      };
    }
  } catch {
    return null;
  }

  return null;
}

function getGitHistory(repoRelativePath) {
  try {
    const output = execFileSync(
      "git",
      ["log", "--follow", "--format=%cs\t%s", "--", repoRelativePath],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [date, ...messageParts] = line.split("\t");
        return { date, message: messageParts.join("\t") };
      });
  } catch {
    return [];
  }
}

async function getFileDates(absolutePath, repoRelativePath) {
  const gitDates = getGitDates(repoRelativePath);
  if (gitDates) {
    return gitDates;
  }

  const fileStats = await stat(absolutePath);
  return {
    created: formatDate(fileStats.birthtimeMs || fileStats.ctimeMs || fileStats.mtimeMs),
    updated: formatDate(fileStats.mtimeMs),
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
  // 記事でも画像でもないファイル (辞書 json・docx・Obsidian の .base など) は公開しない
  const unpublishedPaths = allFiles
    .filter((filePath) => !CONTENT_FILE_EXTENSIONS.test(filePath) && !IMAGE_FILE_EXTENSIONS.test(filePath))
    .map((filePath) => toPosixPath(path.relative(projectRoot, filePath)));

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

  for (const absolutePath of markdownFiles) {
    const relativeToContent = toPosixPath(path.relative(contentRoot, absolutePath));
    const repoRelativePath = toPosixPath(path.relative(projectRoot, absolutePath));
    const fileBasename = path.basename(absolutePath, path.extname(absolutePath));
    const sourceText = await readFile(absolutePath, "utf8");
    if (getUnpublishedReason(sourceText)) {
      unpublishedPaths.push(repoRelativePath);
      continue;
    }

    const dates = await getFileDates(absolutePath, repoRelativePath);
    const history = getGitHistory(repoRelativePath);

    const record = buildArticleRecord({
      relativePath: relativeToContent,
      fileBasename,
      sourceText,
      created: dates.created,
      updated: dates.updated,
      templateHandlers,
      resolveAssetPath,
    });
    record.history = history;
    entries.push(record);
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
    unpublishedPaths,
    contentBuildInfo: {
      totalMarkdownFiles: markdownFiles.length,
      unpublishedFileCount: unpublishedPaths.length,
      publishedArticleCount: publishedEntries.length,
      generatedAt: new Date().toISOString(),
    },
    generatedArticles: sortEntries(publishedEntries),
  };
}

const EXCLUDE_BLOCK_START = "# >>> build:content が自動生成: 非公開の原稿 (手で編集しない) >>>";
const EXCLUDE_BLOCK_END = "# <<< build:content <<<";

function escapeGitignorePath(repoRelativePath) {
  return `/${repoRelativePath.replace(/[\\*?[\]!#]/g, "\\$&")}`;
}

// 非公開の原稿を .git/info/exclude に載せ、うっかりコミットされないようにする。
// リポジトリに含まれる .gitignore ではなくローカル専用の exclude を使うのは、
// 未公開記事のファイル名 (= タイトル) を公開リポジトリに出さないため。
async function updateGitExclude(unpublishedPaths) {
  let excludePath;
  try {
    excludePath = path.resolve(
      projectRoot,
      execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    );
  } catch {
    return;
  }

  let current = "";
  try {
    current = await readFile(excludePath, "utf8");
  } catch {
    // exclude がまだ無ければ新規に作る
  }

  const blockPattern = new RegExp(
    `\\n?${EXCLUDE_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${EXCLUDE_BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`
  );
  const withoutBlock = current.replace(blockPattern, "\n").replace(/\n+$/, "");
  const block = [
    EXCLUDE_BLOCK_START,
    ...[...unpublishedPaths].sort().map(escapeGitignorePath),
    EXCLUDE_BLOCK_END,
  ].join("\n");

  await mkdir(path.dirname(excludePath), { recursive: true });
  await writeFile(excludePath, `${withoutBlock ? `${withoutBlock}\n\n` : ""}${block}\n`, "utf8");
}

function serializeModule({ contentBuildInfo, generatedArticles }) {
  return `export const contentBuildInfo = ${JSON.stringify(contentBuildInfo, null, 2)};\n\nexport const generatedArticles = ${JSON.stringify(generatedArticles, null, 2)};\n`;
}

const contentData = await buildContentData();
await mkdir(generatedDataDir, { recursive: true });
await writeFile(generatedDataPath, serializeModule(contentData), "utf8");
await updateGitExclude(contentData.unpublishedPaths);

console.log(
  `Generated ${contentData.generatedArticles.length} article records at ${path.relative(projectRoot, generatedDataPath)}` +
    ` (非公開 ${contentData.unpublishedPaths.length} 件は除外)`
);
