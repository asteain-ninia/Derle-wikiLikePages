import { collectTextsFromParagraph } from "./article-page-model.js";

export function formatDisplayDate(value) {
  return value.replaceAll("-", ".");
}

export function sortEntriesByDate(entries, field) {
  return [...entries].sort((left, right) => right[field].localeCompare(left[field]));
}

export function selectFeaturedEntry(entries, preferredFeaturedId) {
  if (entries.length === 0) {
    return null;
  }

  return entries.find((entry) => entry.id === preferredFeaturedId) ?? entries[0];
}

export function pickRandomEntry(entries, random = Math.random) {
  if (entries.length === 0) {
    return null;
  }

  const index = Math.floor(random() * entries.length);
  return entries[index] ?? entries[0];
}

export function findEntryById(entries, entryId) {
  return entries.find((entry) => entry.id === entryId) ?? null;
}

export function searchArticles(entries, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return entries.filter((entry) => {
    const searchable = [
      entry.title,
      entry.category,
      entry.summary,
      entry.preview,
      ...(entry.aliases ?? []),
      ...(entry.tags ?? []),
      ...(entry.keywords ?? []),
      ...((entry.sections ?? []).flatMap((section) => [
        section.heading,
        section.sourceHeading,
        ...(section.paragraphs ?? []).flatMap(collectTextsFromParagraph),
      ])),
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(normalized);
  });
}

export function buildCategoryCards(entries, categoryDefinitions) {
  const articleCountByCategory = entries.reduce((accumulator, entry) => {
    accumulator[entry.category] = (accumulator[entry.category] ?? 0) + 1;
    return accumulator;
  }, {});

  // 定義済みのカテゴリを定義順に並べ、定義に無いカテゴリは後ろに足す。記事が無いカテゴリは出さない
  const definedNames = new Set(categoryDefinitions.map((category) => category.name));
  const undefinedCategories = Object.keys(articleCountByCategory)
    .filter((name) => !definedNames.has(name))
    .sort((left, right) => left.localeCompare(right, "ja-JP"))
    .map((name) => ({ name, description: "" }));

  return [...categoryDefinitions, ...undefinedCategories]
    .map((category) => ({
      ...category,
      articleCount: articleCountByCategory[category.name] ?? 0,
    }))
    .filter((category) => category.articleCount > 0);
}

export function buildHomePageModel({ articles, siteConfig }) {
  const categoryCards = buildCategoryCards(articles, siteConfig.categoryDefinitions);
  const featuredEntry = selectFeaturedEntry(articles, siteConfig.preferredFeaturedId);
  const newArticles = sortEntriesByDate(articles, "created").slice(0, siteConfig.newArticleLimit);
  const recentUpdates = sortEntriesByDate(articles, "updated").slice(0, siteConfig.recentUpdateLimit);
  const latestUpdatedEntry = recentUpdates[0] ?? null;
  const activeCategoryCount = categoryCards.filter((category) => category.articleCount > 0).length;

  return {
    featuredEntry,
    previewEntry: featuredEntry,
    newArticles,
    recentUpdates,
    categoryCards,
    stats: {
      articleCount: articles.length,
      categoryCount: activeCategoryCount,
      latestUpdatedDate: latestUpdatedEntry?.updated ?? "",
    },
  };
}
