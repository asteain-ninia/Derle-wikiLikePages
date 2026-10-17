import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCategoryCards,
  buildHomePageModel,
  findEntryById,
  formatDisplayDate,
  pickRandomEntry,
  searchArticles,
  selectFeaturedEntry,
  sortEntriesByDate,
} from "../src/lib/home-page-model.js";

const fixtureArticles = [
  {
    id: "a",
    title: "白磁海",
    aliases: ["白海"],
    category: "世界設定",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "海域ページ",
    preview: "交易と海図の中心",
    tags: ["地理"],
    keywords: ["交易"],
    sections: [
      {
        heading: "概要",
        paragraphs: ["灯台列島を扱う。"],
      },
    ],
  },
  {
    id: "b",
    title: "封蝋院",
    category: "組織",
    created: "2026-03-11",
    updated: "2026-03-14",
    summary: "行政機関",
    preview: "通行証を管理する",
    keywords: ["行政"],
  },
  {
    id: "c",
    title: "灰塔の記録官リィナ",
    category: "人物",
    created: "2026-03-12",
    updated: "2026-03-13",
    summary: "記録官",
    preview: "証言と海図改訂記録を残した",
    keywords: ["証言"],
  },
];

const fixtureSiteConfig = {
  preferredFeaturedId: "b",
  newArticleLimit: 2,
  recentUpdateLimit: 2,
  categoryDefinitions: [
    { name: "世界設定", description: "desc" },
    { name: "人物", description: "desc" },
    { name: "組織", description: "desc" },
    { name: "年表", description: "desc" },
  ],
};

test("formatDisplayDate converts ISO-like dates for display", () => {
  assert.equal(formatDisplayDate("2026-03-17"), "2026.03.17");
});

test("sortEntriesByDate sorts descending by target field", () => {
  const sorted = sortEntriesByDate(fixtureArticles, "updated");
  assert.deepEqual(
    sorted.map((entry) => entry.id),
    ["a", "b", "c"]
  );
});

test("selectFeaturedEntry returns preferred entry when it exists", () => {
  const featured = selectFeaturedEntry(fixtureArticles, "b");
  assert.equal(featured?.title, "封蝋院");
});

test("selectFeaturedEntry falls back to the first entry", () => {
  const featured = selectFeaturedEntry(fixtureArticles, "missing");
  assert.equal(featured?.title, "白磁海");
});

test("pickRandomEntry uses injected random function", () => {
  const picked = pickRandomEntry(fixtureArticles, () => 0.6);
  assert.equal(picked?.id, "b");
});

test("findEntryById returns null for unknown ids", () => {
  assert.equal(findEntryById(fixtureArticles, "missing"), null);
});

test("searchArticles searches title, summary, preview, category and keywords", () => {
  const matches = searchArticles(fixtureArticles, "海図");
  assert.deepEqual(
    matches.map((entry) => entry.id),
    ["a", "c"]
  );
});

test("searchArticles also searches aliases, tags and section text", () => {
  assert.deepEqual(
    searchArticles(fixtureArticles, "白海").map((entry) => entry.id),
    ["a"]
  );
  assert.deepEqual(
    searchArticles(fixtureArticles, "地理").map((entry) => entry.id),
    ["a"]
  );
  assert.deepEqual(
    searchArticles(fixtureArticles, "灯台列島").map((entry) => entry.id),
    ["a"]
  );
});

test("buildCategoryCards counts articles by category definition", () => {
  const cards = buildCategoryCards(fixtureArticles, fixtureSiteConfig.categoryDefinitions);
  assert.deepEqual(
    cards.map((card) => ({ name: card.name, articleCount: card.articleCount })),
    [
      { name: "世界設定", articleCount: 1 },
      { name: "人物", articleCount: 1 },
      { name: "組織", articleCount: 1 },
      { name: "年表", articleCount: 0 },
    ]
  );
});

test("buildHomePageModel assembles the home page state", () => {
  const model = buildHomePageModel({
    articles: fixtureArticles,
    siteConfig: fixtureSiteConfig,
  });

  assert.equal(model.featuredEntry?.id, "b");
  assert.equal(model.previewEntry?.id, "b");
  assert.deepEqual(
    model.newArticles.map((entry) => entry.id),
    ["c", "b"]
  );
  assert.deepEqual(
    model.recentUpdates.map((entry) => entry.id),
    ["a", "b"]
  );
  assert.deepEqual(model.stats, {
    articleCount: 3,
    categoryCount: 3,
    latestUpdatedDate: "2026-03-15",
  });
});
