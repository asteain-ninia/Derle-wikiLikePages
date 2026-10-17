import { execFile } from "node:child_process";
import { existsSync, mkdirSync, watch } from "node:fs";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveVaultPath, syncVault } from "./sync-vault.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const requestedPort = Number.parseInt(process.env.PORT ?? "4173", 10);
const port = Number.isNaN(requestedPort) ? 4173 : requestedPort;
const host = process.env.HOST ?? "127.0.0.1";

const watchedDirectories = [
  path.join(projectRoot, "content"),
  path.join(projectRoot, "src", "lib", "templates"),
];
const reloadEventPath = "/__dev/reload";
const reloadClientScript = `<script>new EventSource("${reloadEventPath}").onmessage = () => location.reload();</script>`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function getContentType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function resolveRequestPath(urlPathname) {
  const sanitizedPath = decodeURIComponent(urlPathname).replace(/^\/+/, "");
  const requestedPath = sanitizedPath || "index.html";
  const absolutePath = path.resolve(projectRoot, requestedPath);
  const relativePath = path.relative(projectRoot, absolutePath);

  // プロジェクト外と、.git などドットで始まるパスは配信しない
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    relativePath.split(path.sep).some((segment) => segment.startsWith("."))
  ) {
    return null;
  }

  return absolutePath;
}

async function resolveFilePath(absolutePath) {
  try {
    const stats = await stat(absolutePath);
    if (stats.isDirectory()) {
      return path.join(absolutePath, "index.html");
    }

    return absolutePath;
  } catch {
    return absolutePath;
  }
}

const reloadClients = new Set();

function notifyReload() {
  for (const client of reloadClients) {
    client.write("data: reload\n\n");
  }
}

let rebuildTimer = null;
let rebuildRunning = false;
let rebuildQueued = false;

function rebuildContent() {
  if (rebuildRunning) {
    rebuildQueued = true;
    return;
  }

  rebuildRunning = true;
  execFile(
    process.execPath,
    [path.join(projectRoot, "scripts", "generate-content-data.mjs")],
    { cwd: projectRoot },
    (error, stdout, stderr) => {
      rebuildRunning = false;
      if (error) {
        // 原稿の不備でビルドが失敗してもサーバーは止めず、直して保存し直せば再試行される
        console.error(`[build:content] 失敗しました\n${stderr || error.message}`);
      } else {
        console.log(`[build:content] ${stdout.trim()}`);
        notifyReload();
      }

      if (rebuildQueued) {
        rebuildQueued = false;
        rebuildContent();
      }
    }
  );
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuildContent, 200);
}

for (const directory of watchedDirectories) {
  mkdirSync(directory, { recursive: true });
  watch(directory, { recursive: true }, scheduleRebuild);
}

// 保管庫の場所が設定されていれば保管庫も監視し、保存のたびに npm run sync 相当を走らせる。
// sync が content/ を書き換えると、上の監視でビルドとブラウザの再読み込みが続く。
let vaultPath = null;
try {
  vaultPath = await resolveVaultPath();
} catch {
  // 未設定なら content/ だけを監視する
}

let syncTimer = null;
function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncVault({ log: (message) => console.log(message) }).catch((error) => {
      console.error(`[sync] 失敗しました: ${error.message}`);
    });
  }, 300);
}

if (vaultPath && existsSync(vaultPath)) {
  watch(vaultPath, { recursive: true }, (_eventType, fileName) => {
    // .obsidian/ (ワークスペースの状態など) や .git/ の変更では同期しない
    if (fileName && String(fileName).split(/[\\/]/).some((segment) => segment.startsWith("."))) {
      return;
    }
    scheduleSync();
  });
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname === reloadEventPath) {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/event-stream",
        connection: "keep-alive",
      });
      response.write(": connected\n\n");
      reloadClients.add(response);
      request.on("close", () => reloadClients.delete(response));
      return;
    }

    const absolutePath = resolveRequestPath(requestUrl.pathname);

    if (!absolutePath) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const filePath = await resolveFilePath(absolutePath);
    let fileContent = await readFile(filePath);

    if (filePath === path.join(projectRoot, "index.html")) {
      fileContent = fileContent.toString("utf8").replace("</body>", `${reloadClientScript}\n</body>`);
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": getContentType(filePath),
    });
    response.end(fileContent);
  } catch (error) {
    const statusCode = error?.code === "ENOENT" ? 404 : 500;
    response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
    response.end(statusCode === 404 ? "Not Found" : "Internal Server Error");
  }
});

// 起動時は同期で何も変わらなくても一度はビルドする
if (vaultPath && existsSync(vaultPath)) {
  await syncVault({ log: (message) => console.log(message) }).catch((error) => {
    console.error(`[sync] 失敗しました: ${error.message}`);
  });
}
rebuildContent();

server.listen(port, host, () => {
  console.log(`WikiLikePages dev server: http://localhost:${port}`);
  console.log(
    vaultPath && existsSync(vaultPath)
      ? `保管庫 (${vaultPath}) を監視しています。保存すると同期・ビルドしてブラウザを再読み込みします。`
      : "content/ の変更を監視しています。保存するとビルドしてブラウザを再読み込みします。"
  );
});
