import { statSync } from "node:fs";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { siteConfig } from "../src/data/site-config.js";
import { buildStaticSite } from "../src/lib/static-pages.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");

const requiredEntries = ["index.html", "src"];
const optionalEntries = ["CNAME", "favicon.ico", "robots.txt"];
const IMAGE_FILE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg)$/i;

function pathExists(targetPath) {
  return access(targetPath).then(
    () => true,
    () => false
  );
}

execFileSync("node", ["scripts/generate-content-data.mjs"], {
  cwd: projectRoot,
  stdio: "inherit",
});

await rm(distRoot, { recursive: true, force: true });
await mkdir(distRoot, { recursive: true });

for (const entry of requiredEntries) {
  await cp(path.join(projectRoot, entry), path.join(distRoot, entry), {
    recursive: true,
  });
}

for (const entry of optionalEntries) {
  const sourcePath = path.join(projectRoot, entry);
  if (await pathExists(sourcePath)) {
    await cp(sourcePath, path.join(distRoot, entry), { recursive: true });
  }
}

// 記事から参照する画像は content/ のどこに置いてもよいので、画像だけを構成ごとコピーする
// (原稿そのものはビルド済みデータに入っているので配信しない)
const contentRoot = path.join(projectRoot, "content");
await cp(contentRoot, path.join(distRoot, "content"), {
  recursive: true,
  filter: (sourcePath) => {
    if (sourcePath === contentRoot) {
      return true;
    }
    if (path.basename(sourcePath).startsWith(".")) {
      return false;
    }
    return statSync(sourcePath).isDirectory() || IMAGE_FILE_EXTENSIONS.test(sourcePath);
  },
});

// 記事・カテゴリごとの静的ページ (wiki/…/index.html, category/…/index.html) と sitemap.xml / robots.txt。
// SPA (index.html + src/) はそのまま配信し、静的ページは同じ描画関数で本文を書いた別の入口 (src/lib/static-pages.js)
const { generatedArticles, imageSizes } = await import(
  pathToFileURL(path.join(projectRoot, "src", "data", "generated", "content-data.js")).href
);
const imageByteSizes = Object.fromEntries(
  Object.keys(imageSizes).map((contentPath) => [contentPath, statSync(path.join(contentRoot, contentPath)).size])
);
const indexHtml = await readFile(path.join(projectRoot, "index.html"), "utf8");
const staticSite = buildStaticSite({
  articles: generatedArticles,
  indexHtml,
  siteUrl: process.env.SITE_URL || siteConfig.siteUrl,
  siteName: siteConfig.siteName,
  imageSizes,
  imageByteSizes,
});

for (const page of staticSite.pages) {
  const outputPath = path.join(distRoot, ...page.filePath.split("/"));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, page.html, "utf8");
}
await writeFile(path.join(distRoot, "index.html"), staticSite.homeHtml, "utf8");
await writeFile(path.join(distRoot, "sitemap.xml"), staticSite.sitemap, "utf8");
// robots.txt を自分で置いていればそちらを使う (上の optionalEntries でコピー済み)
if (!(await pathExists(path.join(projectRoot, "robots.txt")))) {
  await writeFile(path.join(distRoot, "robots.txt"), staticSite.robots, "utf8");
}

await writeFile(path.join(distRoot, ".nojekyll"), "", "utf8");

console.log(
  `Built static site at ${path.relative(projectRoot, distRoot)} (静的ページ ${staticSite.pages.length} 件, URL ${staticSite.siteUrl})`
);
