import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
    return !path.extname(sourcePath) || IMAGE_FILE_EXTENSIONS.test(sourcePath);
  },
});

await writeFile(path.join(distRoot, ".nojekyll"), "", "utf8");

console.log(`Built static site at ${path.relative(projectRoot, distRoot)}`);
