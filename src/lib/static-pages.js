// 記事・カテゴリごとの静的 HTML (dist/article/…/index.html, dist/category/…/index.html) と
// sitemap.xml / robots.txt を組み立てる。ファイルには触れず、文字列だけを返す
// (書き出しは scripts/build-site.mjs、開発サーバーは scripts/dev-server.mjs がその場で返す)。
//
// 静的ページは SPA (index.html + src/main.js) と同じ描画関数 (renderers.js) で本文を描き、
// JavaScript を読み込まない。検索エンジン・SNS のカード・JavaScript なしの読者が本文を読めるようにするためのもの。
// 本文中の記事リンクは静的ページどうしをつなぎ、未作成記事・曖昧な名称・保守レポートなど
// 静的ページの無い画面へのリンクは SPA (#!…) へ向ける。SPA 側の URL と動きは変えない

import {
  buildArticlePageModel,
  buildSectionAnchorId,
  buildStaticArticleHref,
  buildStaticCategoryHref,
  buildWikiGraph,
  matchSectionHeading,
  parseAppRoute,
} from "./article-page-model.js";
import { escapeHtml, renderArticlePage, renderCategoryPage, setImageSizes } from "./renderers.js";

// og:image に使う画像の大きさの上限。X (旧 Twitter) のカードが 5MB まで、Facebook が 8MB まで
export const OG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const DESCRIPTION_MAX_LENGTH = 120;

// Windows でファイル名にできない文字と制御文字。名前にこれがあるカテゴリは静的ページを作らず SPA へリンクする
const UNSAFE_PATH_CHARACTERS = /[\\:*?"<>|\u0000-\u001f]/;

export function normalizeSiteUrl(siteUrl) {
  let url;
  try {
    url = new URL(String(siteUrl ?? "").trim());
  } catch {
    throw new Error(`サイトの URL が読めません: "${siteUrl}" (site-config.js の siteUrl か環境変数 SITE_URL)`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`サイトの URL は http(s):// で始めてください: "${siteUrl}"`);
  }
  url.search = "";
  url.hash = "";
  return url.href.endsWith("/") ? url.href : `${url.href}/`;
}

// 静的ページにできる名前か (区切りの / で分けた各部分が空・「.」「..」でなく、ファイル名にできない文字を含まない)
export function isStaticPathSafeName(name) {
  const segments = String(name).split("/");
  return segments.every(
    (segment) =>
      segment !== "" &&
      segment !== "." &&
      segment !== ".." &&
      !UNSAFE_PATH_CHARACTERS.test(segment) &&
      !/[. ]$/.test(segment)
  );
}

// "article/%E5%9B%BD/…/" → "article/国/…/index.html" (dist/ からのファイルの場所)
export function staticHrefToFilePath(href) {
  return `${href
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent)
    .join("/")}/index.html`;
}

// 静的ページからサイト直下へ戻る相対パス ("article/国/アクセル/" → "../../../")
export function rootPrefixFor(href) {
  return "../".repeat(href.split("/").filter(Boolean).length);
}

export function summarizeForDescription(text, maxLength = DESCRIPTION_MAX_LENGTH) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  // デーレ文字などサロゲートペアの文字を途中で切らないよう、文字単位で数える
  const characters = Array.from(normalized);
  if (characters.length <= maxLength) {
    return normalized;
  }
  return `${characters.slice(0, maxLength - 1).join("")}…`;
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const URL_ATTRIBUTE_PATTERN = /(\s(?:href|src))="([^"]*)"/g;
// サイト直下からの相対パスで書かれた (SPA の index.html から見た) 中身の場所
const SITE_RELATIVE_PREFIXES = ["content/", "src/", "article/", "category/"];

// SPA 向けに描画した HTML の href / src を、静的ページの場所から正しく辿れるように書き換える。
// - #!article/ID[/見出し]: 静的ページ (article/ID/#section-…) へ
// - #!category/名前: 静的ページがあればそこへ、無ければ SPA へ
// - そのほかの #!…、ページ内に無い #id (パンくずの #overview など): SPA (サイト直下) へ
// - ページ内の #id (目次・脚注)、外部リンク: そのまま
// - content/ や article/ などサイト直下からの相対パス: サイト直下からに付け直す
export function rewriteInternalUrls(html, { rootPrefix, entryById, staticCategoryNames = new Set() }) {
  const idsInPage = new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((match) => decodeHtmlAttribute(match[1])));

  const mapUrl = (url) => {
    if (url.startsWith("#!")) {
      let route;
      try {
        route = parseAppRoute(url);
      } catch {
        return `${rootPrefix}${url}`;
      }
      if (route.view === "article" && entryById.has(route.entryId)) {
        const entry = entryById.get(route.entryId);
        const heading = route.sectionHeading ? matchSectionHeading(entry, route.sectionHeading) : "";
        const fragment = heading ? `#${buildSectionAnchorId(heading)}` : "";
        return `${rootPrefix}${buildStaticArticleHref(entry.id)}${fragment}`;
      }
      if (route.view === "category" && staticCategoryNames.has(route.category)) {
        return `${rootPrefix}${buildStaticCategoryHref(route.category)}`;
      }
      return `${rootPrefix}${url}`;
    }
    if (url.startsWith("#")) {
      return idsInPage.has(url.slice(1)) ? url : `${rootPrefix}${url}`;
    }
    if (SITE_RELATIVE_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      return `${rootPrefix}${url}`;
    }
    return url;
  };

  return html.replace(URL_ATTRIBUTE_PATTERN, (match, attribute, rawValue) => {
    const value = decodeHtmlAttribute(rawValue);
    const mapped = mapUrl(value);
    return mapped === value ? match : `${attribute}="${escapeHtml(mapped)}"`;
  });
}

// 記事を代表する画像 (content/ からのパス)。インフォボックス (サイドバー) の画像を先に、無ければ本文の最初の画像。
// 大きすぎる画像は SNS がカードに使わないので飛ばす (大きさが分からない画像は使う)
export function pickRepresentativeImage(articleHtml, { imageByteSizes = {}, maxBytes = OG_IMAGE_MAX_BYTES } = {}) {
  const sidebarStart = articleHtml.indexOf('class="article-page__sidebar"');
  const parts =
    sidebarStart === -1 ? [articleHtml] : [articleHtml.slice(sidebarStart), articleHtml.slice(0, sidebarStart)];

  for (const part of parts) {
    for (const match of part.matchAll(/<img\b[^>]*\ssrc="([^"]*)"[^>]*>/g)) {
      const src = decodeHtmlAttribute(match[1]);
      if (!src.startsWith("content/")) {
        continue;
      }
      let contentPath;
      try {
        contentPath = src.slice("content/".length).split("/").map(decodeURIComponent).join("/");
      } catch {
        continue;
      }
      const bytes = imageByteSizes[contentPath];
      if (bytes !== undefined && bytes > maxBytes) {
        continue;
      }
      const altMatch = match[0].match(/\salt="([^"]*)"/);
      return { contentPath, src, alt: altMatch ? decodeHtmlAttribute(altMatch[1]) : "" };
    }
  }
  return null;
}

// index.html のヘッダーを静的ページ用にする。リンクをサイト直下からに付け直し、
// 検索欄は SPA へ ?q= で送る普通のフォームにする (おまかせ表示は JavaScript が要るので外す)
export function buildStaticSiteHeader(indexHtml, rootPrefix) {
  const headerMatch = indexHtml.match(/<header class="site-header">[\s\S]*?<\/header>/);
  if (!headerMatch) {
    throw new Error('index.html に <header class="site-header"> が見つかりません (静的ページのヘッダーに使います)');
  }

  const header = headerMatch[0]
    .replace(/<form class="search-form"[^>]*>/, (tag) =>
      tag.replace(/>$/, ` action="${escapeHtml(rootPrefix)}" method="get">`)
    )
    .replace(/<input\b([^>]*)\sid="search-input"/, '<input$1 id="search-input" name="q"')
    .replace(/\s*<button\b[^>]*id="random-button"[^>]*>[\s\S]*?<\/button>/, "");

  return rewriteInternalUrls(header, { rootPrefix, entryById: new Map() });
}

function renderMetaTags({ siteName, title, description, canonicalUrl, ogType, image, published, modified }) {
  const tags = [
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta property="og:type" content="${escapeHtml(ogType)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
  ];
  if (image) {
    tags.push(`<meta property="og:image" content="${escapeHtml(image.url)}">`);
    if (image.width && image.height) {
      tags.push(`<meta property="og:image:width" content="${image.width}">`);
      tags.push(`<meta property="og:image:height" content="${image.height}">`);
    }
    if (image.alt) {
      tags.push(`<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`);
    }
  }
  if (published) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(published)}">`);
  }
  if (modified) {
    tags.push(`<meta property="article:modified_time" content="${escapeHtml(modified)}">`);
  }
  tags.push(`<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`);
  return tags.map((tag) => `  ${tag}`).join("\n");
}

export function renderStaticDocument({
  siteName,
  documentTitle,
  title,
  description,
  canonicalUrl,
  ogType,
  image = null,
  published = "",
  modified = "",
  rootPrefix,
  headerHtml,
  heading,
  lead,
  bodyHtml,
  pageKind,
}) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(documentTitle)}</title>
${renderMetaTags({ siteName, title, description, canonicalUrl, ogType, image, published, modified })}
  <link rel="stylesheet" href="${escapeHtml(rootPrefix)}src/styles.css">
</head>
<body data-static-page="${escapeHtml(pageKind)}">
  ${headerHtml}

  <main class="page">
    <div class="page-title">
      <h1 id="page-heading">${escapeHtml(heading)}</h1>
      <p id="page-lead">${escapeHtml(lead)}</p>
    </div>

    <section class="detail-view" id="detail-view">${bodyHtml}</section>
  </main>${
    // 静的ページは原則 JavaScript を読まない。例外として、計算機のあるページだけ計算機のスクリプトを読む
    bodyHtml.includes("data-loom-calc")
      ? `\n  <script type="module" src="${escapeHtml(rootPrefix)}src/loom-page.js"></script>`
      : ""
  }
</body>
</html>
`;
}

// 記事・カテゴリの静的ページの一覧。カテゴリは SPA と同じく、種別とタグの名前すべて
export function collectStaticCategoryNames(articles) {
  const names = new Set();
  for (const entry of articles) {
    if (entry.category) {
      names.add(entry.category);
    }
    for (const tag of entry.tags ?? []) {
      names.add(tag);
    }
  }
  return [...names].filter(isStaticPathSafeName).sort((a, b) => a.localeCompare(b, "ja-JP"));
}

// 大文字小文字や Unicode の正規化だけが違うパスは、Windows・macOS で同じファイルになる
export function findStaticPathCollisions(filePaths) {
  const byKey = new Map();
  for (const filePath of filePaths) {
    const key = filePath.normalize("NFC").toLowerCase();
    byKey.set(key, [...(byKey.get(key) ?? []), filePath]);
  }
  return [...byKey.values()].filter((paths) => paths.length > 1);
}

function latestDate(dates) {
  return dates.filter(Boolean).sort().at(-1) ?? "";
}

export function buildStaticArticlePage(graph, entryId, context) {
  const { siteName, siteUrl, headerFor, imageSizes = {}, imageByteSizes = {}, staticCategoryNames } = context;
  const pageModel = buildArticlePageModel(graph, entryId);
  if (!pageModel) {
    return null;
  }

  const href = buildStaticArticleHref(pageModel.id);
  const rootPrefix = rootPrefixFor(href);
  const articleHtml = renderArticlePage(pageModel);
  const canonicalUrl = new URL(href, siteUrl).href;
  const lead = pageModel.summary || `${pageModel.category}の記事です。`;

  const picked = pickRepresentativeImage(articleHtml, { imageByteSizes });
  const size = picked ? imageSizes[picked.contentPath] : null;
  const image = picked
    ? {
        url: new URL(picked.src, siteUrl).href,
        width: size?.[0],
        height: size?.[1],
        // 本文の画像の alt はファイル名なので、拡張子を外して説明にする
        alt: picked.alt.replace(/\.(png|jpe?g|gif|webp|svg)$/i, "") || pageModel.title,
      }
    : null;

  const html = renderStaticDocument({
    siteName,
    documentTitle: `${pageModel.title} - ${siteName}`,
    title: pageModel.title,
    description: summarizeForDescription(pageModel.summary || pageModel.preview || lead),
    canonicalUrl,
    ogType: "article",
    image,
    published: pageModel.created,
    modified: pageModel.updated,
    rootPrefix,
    headerHtml: headerFor(rootPrefix),
    heading: pageModel.title,
    lead,
    bodyHtml: rewriteInternalUrls(articleHtml, { rootPrefix, entryById: graph.entryById, staticCategoryNames }),
    pageKind: "article",
  });

  return { href, filePath: staticHrefToFilePath(href), url: canonicalUrl, lastmod: pageModel.updated, html };
}

export function buildStaticCategoryPage(categoryName, articles, context) {
  const { siteName, siteUrl, headerFor, entryById, staticCategoryNames } = context;
  const href = buildStaticCategoryHref(categoryName);
  const rootPrefix = rootPrefixFor(href);
  const canonicalUrl = new URL(href, siteUrl).href;
  const members = articles.filter(
    (entry) => entry.category === categoryName || (entry.tags ?? []).includes(categoryName)
  );
  const lead = `「${categoryName}」カテゴリの記事一覧です。`;

  const html = renderStaticDocument({
    siteName,
    documentTitle: `${categoryName} - カテゴリ - ${siteName}`,
    title: `${categoryName} (カテゴリ)`,
    description: summarizeForDescription(
      `${lead}${members.map((entry) => entry.title).join("、")}`
    ),
    canonicalUrl,
    ogType: "website",
    rootPrefix,
    headerHtml: headerFor(rootPrefix),
    heading: categoryName,
    lead,
    bodyHtml: rewriteInternalUrls(renderCategoryPage(categoryName, articles), {
      rootPrefix,
      entryById,
      staticCategoryNames,
    }),
    pageKind: "category",
  });

  return {
    href,
    filePath: staticHrefToFilePath(href),
    url: canonicalUrl,
    lastmod: latestDate(members.map((entry) => entry.updated)),
    html,
  };
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemap(entries) {
  const urls = entries
    .map(({ url, lastmod }) => {
      const lastmodTag = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(url)}</loc>${lastmodTag}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildRobotsTxt(siteUrl) {
  return `User-agent: *
Allow: /

Sitemap: ${new URL("sitemap.xml", siteUrl).href}
`;
}

// SPA の入口 (dist/index.html) にも canonical と OGP を足す。記事の画面 (#!article/…) を共有しても
// SNS は # より後ろを見ないので、カードはメインページのものになる (記事を共有するときは固定リンクを使う)
export function injectHomePageMeta(indexHtml, { siteName, siteUrl }) {
  const descriptionMatch = indexHtml.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  const description = descriptionMatch ? decodeHtmlAttribute(descriptionMatch[1]) : siteName;
  const tags = [
    `<link rel="canonical" href="${escapeHtml(siteUrl)}">`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escapeHtml(siteName)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(siteUrl)}">`,
    `<meta name="twitter:card" content="summary">`,
  ];
  if (!indexHtml.includes("</head>")) {
    throw new Error("index.html に </head> が見つかりません");
  }
  return indexHtml.replace("</head>", `${tags.map((tag) => `  ${tag}`).join("\n")}\n</head>`);
}

// 静的ページ一式。pages は dist/ からのファイルの場所と中身、sitemapEntries は sitemap.xml に載せる URL
export function buildStaticSite({
  articles,
  indexHtml,
  siteUrl,
  siteName,
  imageSizes = {},
  imageByteSizes = {},
}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  setImageSizes(imageSizes);
  const graph = buildWikiGraph(articles);
  const staticCategoryNames = new Set(collectStaticCategoryNames(articles));
  const headerCache = new Map();
  const headerFor = (rootPrefix) => {
    if (!headerCache.has(rootPrefix)) {
      headerCache.set(rootPrefix, buildStaticSiteHeader(indexHtml, rootPrefix));
    }
    return headerCache.get(rootPrefix);
  };
  const context = {
    siteName,
    siteUrl: normalizedSiteUrl,
    headerFor,
    imageSizes,
    imageByteSizes,
    entryById: graph.entryById,
    staticCategoryNames,
  };

  const unsafeIds = articles.map((entry) => entry.id).filter((id) => !isStaticPathSafeName(id));
  if (unsafeIds.length > 0) {
    throw new Error(`静的ページの URL にできない記事 ID があります: ${unsafeIds.join(", ")}`);
  }

  const articlePages = articles.map((entry) => buildStaticArticlePage(graph, entry.id, context));
  const categoryPages = [...staticCategoryNames].map((name) =>
    buildStaticCategoryPage(name, articles, context)
  );
  const pages = [...articlePages, ...categoryPages];

  const collisions = findStaticPathCollisions(pages.map((page) => page.filePath));
  if (collisions.length > 0) {
    throw new Error(
      `大文字小文字などだけが違う静的ページがあり、Windows などで同じファイルになります。原稿の名前を変えてください。\n${collisions
        .map((paths) => `  ${paths.join(" / ")}`)
        .join("\n")}`
    );
  }

  const sitemapEntries = [
    { url: normalizedSiteUrl, lastmod: latestDate(articles.map((entry) => entry.updated)) },
    ...pages.map(({ url, lastmod }) => ({ url, lastmod })),
  ];

  return {
    siteUrl: normalizedSiteUrl,
    pages,
    sitemap: buildSitemap(sitemapEntries),
    robots: buildRobotsTxt(normalizedSiteUrl),
    homeHtml: injectHomePageMeta(indexHtml, { siteName, siteUrl: normalizedSiteUrl }),
  };
}
