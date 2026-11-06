import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildArticleRecord } from "../src/lib/content-import.js";
import {
  buildArticlePageModel,
  buildStaticArticleHref,
  buildStaticCategoryHref,
  buildWikiGraph,
} from "../src/lib/article-page-model.js";
import { renderArticlePage, setImageSizes } from "../src/lib/renderers.js";
import {
  OG_IMAGE_MAX_BYTES,
  buildStaticSite,
  buildStaticSiteHeader,
  findStaticPathCollisions,
  isStaticPathSafeName,
  normalizeSiteUrl,
  pickRepresentativeImage,
  rewriteInternalUrls,
  rootPrefixFor,
  staticHrefToFilePath,
  summarizeForDescription,
} from "../src/lib/static-pages.js";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SITE_URL = "https://example.github.io/wiki/";

function makeEntry(relativePath, sourceText, dates = {}) {
  const fileBasename = relativePath.split("/").at(-1).replace(/\.[^.]+$/, "");
  return buildArticleRecord({
    relativePath,
    fileBasename,
    sourceText,
    created: dates.created ?? "2026-03-10",
    updated: dates.updated ?? "2026-03-15",
    resolveAssetPath: (name) => (name.includes("/") ? name : `画像/${name}`),
  });
}

const fixtureArticles = [
  makeEntry(
    "国/アクセル.md",
    `---
種別: 国
---
アクセルは、出界に存在する国家である。[[出界]]の[[出界#地理|地理]]も参照。[[未作成の地名]]がある。

## 歴史
古い国である。

## 地理
![[アクセル地図.png]]
平野が広がる。

[[Category:大圏]]
`,
    { updated: "2026-04-01" }
  ),
  makeEntry(
    "出界.md",
    `---
種別: 世界
---
出界は世界である。[[国/アクセル|アクセル]]がある。

## 地理
大陸がある。

## 歴史
長い歴史がある。
`
  ),
];

const imageSizes = { "画像/アクセル地図.png": [800, 600] };

function buildFixtureSite(overrides = {}) {
  return buildStaticSite({
    articles: fixtureArticles,
    indexHtml,
    siteUrl: SITE_URL,
    siteName: "出界百科",
    imageSizes,
    ...overrides,
  });
}

function pageFor(site, filePath) {
  const page = site.pages.find((candidate) => candidate.filePath === filePath);
  assert.ok(page, `${filePath} が生成されていない`);
  return page;
}

function metaContent(html, attribute, name) {
  const match = html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)">`));
  return match ? match[1] : null;
}

function detailViewHtml(html) {
  const match = html.match(/<section class="detail-view" id="detail-view">([\s\S]*)<\/section>\n  <\/main>/);
  assert.ok(match, "detail-view が見つからない");
  return match[1];
}

test("静的ページの URL は記事 ID の / をフォルダにし、日本語を区切りごとにエンコードする", () => {
  assert.equal(buildStaticArticleHref("出界"), "article/%E5%87%BA%E7%95%8C/");
  assert.equal(
    buildStaticArticleHref("国/過去の国/エナ国"),
    `article/${encodeURIComponent("国")}/${encodeURIComponent("過去の国")}/${encodeURIComponent("エナ国")}/`
  );
  assert.equal(buildStaticArticleHref("A&B #1?"), "article/A%26B%20%231%3F/");
  assert.equal(buildStaticCategoryHref("過去の国"), `category/${encodeURIComponent("過去の国")}/`);

  assert.equal(staticHrefToFilePath(buildStaticArticleHref("国/過去の国/エナ国")), "article/国/過去の国/エナ国/index.html");
  assert.equal(staticHrefToFilePath(buildStaticArticleHref("A&B #1?")), "article/A&B #1?/index.html");
  assert.equal(rootPrefixFor(buildStaticArticleHref("出界")), "../../");
  assert.equal(rootPrefixFor(buildStaticArticleHref("国/過去の国/エナ国")), "../../../../");
});

test("静的ページにできない名前と、大文字小文字だけが違うパスを見分ける", () => {
  assert.equal(isStaticPathSafeName("国/アクセル"), true);
  assert.equal(isStaticPathSafeName("a//b"), false);
  assert.equal(isStaticPathSafeName("../x"), false);
  assert.equal(isStaticPathSafeName("カテゴリ:何か"), false);
  assert.equal(isStaticPathSafeName("末尾."), false);

  assert.deepEqual(findStaticPathCollisions(["article/Abc/index.html", "article/abc/index.html", "article/x/index.html"]), [
    ["article/Abc/index.html", "article/abc/index.html"],
  ]);
  assert.throws(
    () =>
      buildStaticSite({
        articles: [makeEntry("Abc.md", "本文。"), makeEntry("abc.md", "本文。")],
        indexHtml,
        siteUrl: SITE_URL,
        siteName: "出界百科",
      }),
    /大文字小文字/
  );
});

test("サイトの URL は末尾を / にそろえ、読めない値はビルドを止める", () => {
  assert.equal(normalizeSiteUrl("https://asteain-ninia.github.io/Derle-wikiLikePages"), "https://asteain-ninia.github.io/Derle-wikiLikePages/");
  assert.equal(normalizeSiteUrl("https://example.com/"), "https://example.com/");
  assert.throws(() => normalizeSiteUrl(""), /読めません/);
  assert.throws(() => normalizeSiteUrl("ftp://example.com/"), /http/);
});

test("記事・カテゴリごとに静的ページを作り、title・description・canonical・OGP を入れる", () => {
  const site = buildFixtureSite();
  assert.deepEqual(
    site.pages.map((page) => page.filePath).sort(),
    [
      "article/出界/index.html",
      "article/国/アクセル/index.html",
      "category/世界/index.html",
      "category/国/index.html",
      "category/大圏/index.html",
    ]
  );

  const { html, url } = pageFor(site, "article/国/アクセル/index.html");
  const canonical = `${SITE_URL}article/${encodeURIComponent("国")}/${encodeURIComponent("アクセル")}/`;
  assert.equal(url, canonical);
  assert.match(html, /<title>アクセル - 出界百科<\/title>/);
  assert.match(html, /<html lang="ja">/);
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
  assert.equal(metaContent(html, "property", "og:url"), canonical);
  assert.equal(metaContent(html, "property", "og:type"), "article");
  assert.equal(metaContent(html, "property", "og:title"), "アクセル");
  assert.equal(metaContent(html, "property", "og:site_name"), "出界百科");
  assert.equal(metaContent(html, "property", "article:modified_time"), "2026-04-01");
  assert.match(metaContent(html, "name", "description"), /^アクセルは、出界に存在する国家である。/);
  assert.equal(metaContent(html, "property", "og:description"), metaContent(html, "name", "description"));
  assert.match(html, /<h1 id="page-heading">アクセル<\/h1>/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/\.\.\/src\/styles\.css">/);
  // SPA のスクリプトは読み込まない (本文はすでに描画してある)
  assert.doesNotMatch(html, /<script/);

  const category = pageFor(site, "category/国/index.html");
  assert.equal(metaContent(category.html, "property", "og:type"), "website");
  assert.match(category.html, /<title>国 - カテゴリ - 出界百科<\/title>/);
  assert.ok(category.html.includes('href="../../article/%E5%9B%BD/%E3%82%A2%E3%82%AF%E3%82%BB%E3%83%AB/"'));
});

test("title と meta の値はエスケープする", () => {
  const [entry] = fixtureArticles;
  const tricky = { ...entry, title: `A&B "引用" <script>`, summary: `要約 <b>"x"</b> & 'y'` };
  const site = buildFixtureSite({ articles: [tricky] });
  const { html } = pageFor(site, "article/国/アクセル/index.html");
  assert.ok(html.includes("<title>A&amp;B &quot;引用&quot; &lt;script&gt; - 出界百科</title>"));
  assert.equal(metaContent(html, "property", "og:title"), "A&amp;B &quot;引用&quot; &lt;script&gt;");
  assert.equal(metaContent(html, "name", "description"), "要約 &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39;");
  assert.doesNotMatch(html, /<script>/);
});

test("説明文は 120 字で切り、サロゲートペアの文字を割らない", () => {
  const long = "あ".repeat(130);
  assert.equal(Array.from(summarizeForDescription(long)).length, 120);
  assert.ok(summarizeForDescription(long).endsWith("…"));
  const astral = "\u{F2700}".repeat(130);
  const summarized = summarizeForDescription(astral);
  assert.equal(Array.from(summarized).length, 120);
  assert.equal(Array.from(summarized).slice(0, -1).every((character) => character === "\u{F2700}"), true);
  assert.equal(summarizeForDescription("  改行\nと  空白  "), "改行 と 空白");
});

test("画像のある記事は og:image を絶対 URL で入れ、無い記事は入れない", () => {
  const site = buildFixtureSite();
  const withImage = pageFor(site, "article/国/アクセル/index.html").html;
  assert.equal(
    metaContent(withImage, "property", "og:image"),
    `${SITE_URL}content/${encodeURIComponent("画像")}/${encodeURIComponent("アクセル地図.png")}`
  );
  assert.equal(metaContent(withImage, "property", "og:image:width"), "800");
  assert.equal(metaContent(withImage, "property", "og:image:height"), "600");
  assert.equal(metaContent(withImage, "property", "og:image:alt"), "アクセル地図");
  assert.equal(metaContent(withImage, "name", "twitter:card"), "summary_large_image");

  const withoutImage = pageFor(site, "article/出界/index.html").html;
  assert.doesNotMatch(withoutImage, /og:image/);
  assert.equal(metaContent(withoutImage, "name", "twitter:card"), "summary");
});

test("og:image には大きすぎる画像を使わず、インフォボックスの画像を本文より先に選ぶ", () => {
  const html =
    '<div class="article-page__body"><img src="content/big.png" alt="big.png"><img src="content/small.png" alt="small.png"></div>' +
    '<aside class="article-page__sidebar"><img src="content/%E6%97%97.png" alt="旗"></aside>';
  assert.equal(pickRepresentativeImage(html).contentPath, "旗.png");

  const bodyOnly = html.replace(/<aside[\s\S]*<\/aside>/, "");
  assert.equal(
    pickRepresentativeImage(bodyOnly, { imageByteSizes: { "big.png": OG_IMAGE_MAX_BYTES + 1, "small.png": 1000 } })
      .contentPath,
    "small.png"
  );
  assert.equal(pickRepresentativeImage(bodyOnly, { imageByteSizes: { "big.png": OG_IMAGE_MAX_BYTES + 1, "small.png": OG_IMAGE_MAX_BYTES + 1 } }), null);

  const site = buildFixtureSite({ imageByteSizes: { "画像/アクセル地図.png": OG_IMAGE_MAX_BYTES + 1 } });
  assert.doesNotMatch(pageFor(site, "article/国/アクセル/index.html").html, /og:image/);
});

test("本文は SPA と同じ renderArticlePage の出力で、変えるのはリンク先だけ", () => {
  const site = buildFixtureSite();
  setImageSizes(imageSizes);
  const graph = buildWikiGraph(fixtureArticles);
  const rendered = renderArticlePage(buildArticlePageModel(graph, "国/アクセル"));
  const body = detailViewHtml(pageFor(site, "article/国/アクセル/index.html").html);

  assert.equal(
    body,
    rewriteInternalUrls(rendered, {
      rootPrefix: "../../../",
      entryById: graph.entryById,
      staticCategoryNames: new Set(["国", "世界", "大圏"]),
    })
  );
  const withoutUrls = (html) => html.replace(/\s(href|src)="[^"]*"/g, "");
  assert.equal(withoutUrls(body), withoutUrls(rendered));
});

test("静的ページのリンクは静的ページどうしをつなぎ、静的ページの無い画面は SPA へ向ける", () => {
  const site = buildFixtureSite();
  const body = detailViewHtml(pageFor(site, "article/国/アクセル/index.html").html);
  const hrefs = [...body.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
  const world = "../../../article/%E5%87%BA%E7%95%8C/";

  // 記事へのリンク・見出しへのリンク
  assert.ok(hrefs.includes(world));
  assert.ok(hrefs.some((href) => href.startsWith(`${world}#section-`)));
  // 未作成記事は SPA の画面
  assert.ok(hrefs.includes(`../../../#!missing/${encodeURIComponent("未作成の地名")}`));
  // タグ (カテゴリ) は静的ページ
  assert.ok(hrefs.includes(`../../../category/${encodeURIComponent("大圏")}/`));
  // パンくずのメインページは SPA
  assert.ok(hrefs.includes("../../../#overview"));
  // 目次はページ内の見出しへ (JavaScript なしでも動く)
  const tocHrefs = hrefs.filter((href) => href.startsWith("#section-"));
  assert.equal(tocHrefs.length, 2);
  for (const href of tocHrefs) {
    assert.ok(body.includes(`id="${href.slice(1)}"`));
  }
  // 固定リンクは自分自身、画像はサイト直下の content/
  assert.ok(hrefs.includes(`../../../article/${encodeURIComponent("国")}/${encodeURIComponent("アクセル")}/`));
  assert.ok(body.includes(`src="../../../content/${encodeURIComponent("画像")}/${encodeURIComponent("アクセル地図.png")}"`));
  // SPA のハッシュ (#!article/…) はもう残らない
  assert.ok(hrefs.every((href) => !href.startsWith("#!")));
});

test("ヘッダーは index.html のものを使い、検索欄は SPA へ ?q= で送る", () => {
  const header = buildStaticSiteHeader(indexHtml, "../../");
  assert.match(header, /<form class="search-form"[^>]*action="\.\.\/\.\.\/" method="get">/);
  assert.match(header, /<input[^>]*name="q"/);
  assert.doesNotMatch(header, /random-button/);
  assert.match(header, /href="\.\.\/\.\.\/#overview"/);
  assert.throws(() => buildStaticSiteHeader("<html></html>", "../"), /site-header/);
});

test("sitemap.xml にメインページと静的ページを並べ、robots.txt から指す", () => {
  const site = buildFixtureSite();
  const locs = [...site.sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locs[0], SITE_URL);
  assert.equal(locs.length, 1 + site.pages.length);
  for (const page of site.pages) {
    assert.ok(locs.includes(page.url));
  }
  assert.match(site.sitemap, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(site.sitemap, /<lastmod>2026-04-01<\/lastmod>/);
  assert.match(site.robots, new RegExp(`Sitemap: ${SITE_URL}sitemap.xml`));
});

test("SPA の入口にもメインページの canonical と OGP を足す", () => {
  const site = buildFixtureSite();
  assert.ok(site.homeHtml.includes(`<link rel="canonical" href="${SITE_URL}">`));
  assert.equal(metaContent(site.homeHtml, "property", "og:type"), "website");
  assert.equal(metaContent(site.homeHtml, "property", "og:title"), "出界百科");
  assert.match(site.homeHtml, /<script type="module" src="src\/main\.js"><\/script>/);
  assert.equal(site.homeHtml.replace(/\n  <link rel="canonical"[\s\S]*?(?=\n<\/head>)/, ""), indexHtml);
});
