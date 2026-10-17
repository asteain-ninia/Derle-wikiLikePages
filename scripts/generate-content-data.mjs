import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildArticleRecord } from "../src/lib/content-import.js";
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

async function collectContentFiles(directoryPath) {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const collected = [];

  for (const entry of directoryEntries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collected.push(...(await collectContentFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && CONTENT_FILE_EXTENSIONS.test(entry.name)) {
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
  const markdownFiles = await collectContentFiles(contentRoot);
  const templateHandlers = await loadTemplateHandlers(templatesDir);
  const entries = [];

  for (const absolutePath of markdownFiles) {
    const relativeToContent = toPosixPath(path.relative(contentRoot, absolutePath));
    const repoRelativePath = toPosixPath(path.relative(projectRoot, absolutePath));
    const fileBasename = path.basename(absolutePath, path.extname(absolutePath));
    const sourceText = await readFile(absolutePath, "utf8");
    const dates = await getFileDates(absolutePath, repoRelativePath);
    const history = getGitHistory(repoRelativePath);

    const record = buildArticleRecord({
      relativePath: relativeToContent,
      fileBasename,
      sourceText,
      created: dates.created,
      updated: dates.updated,
      templateHandlers,
    });
    record.history = history;
    entries.push(record);
  }

  const nonDraftEntries = entries.filter((entry) => !entry.draft);
  const publishableEntries = nonDraftEntries.filter((entry) => !entry.isSample);
  const selectedEntries =
    publishableEntries.length > 0 ? publishableEntries : nonDraftEntries;

  return {
    contentBuildInfo: {
      totalMarkdownFiles: markdownFiles.length,
      loadedArticleCount: nonDraftEntries.length,
      publishableArticleCount: publishableEntries.length,
      usingSamplesFallback: publishableEntries.length === 0 && nonDraftEntries.length > 0,
      generatedAt: new Date().toISOString(),
    },
    generatedArticles: sortEntries(selectedEntries),
  };
}

function serializeModule({ contentBuildInfo, generatedArticles }) {
  return `export const contentBuildInfo = ${JSON.stringify(contentBuildInfo, null, 2)};\n\nexport const generatedArticles = ${JSON.stringify(generatedArticles, null, 2)};\n`;
}

const contentData = await buildContentData();
await mkdir(generatedDataDir, { recursive: true });
await writeFile(generatedDataPath, serializeModule(contentData), "utf8");

console.log(
  `Generated ${contentData.generatedArticles.length} article records at ${path.relative(projectRoot, generatedDataPath)}`
);
