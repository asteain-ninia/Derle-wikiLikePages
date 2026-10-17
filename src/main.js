import { articles, contentBuildInfo } from "./data/articles.js";
import { siteConfig } from "./data/site-config.js";
import {
  buildHomePageModel,
  pickRandomEntry,
  searchArticles,
  formatDisplayDate,
} from "./lib/home-page-model.js";
import {
  buildArticleHref,
  buildArticlePageModel,
  buildDisambiguationPageModel,
  buildMissingPageModel,
  buildSectionAnchorId,
  buildWikiGraph,
  parseAppRoute,
} from "./lib/article-page-model.js";
import {
  renderArticlePage,
  renderCategoryCards,
  renderCategoryPage,
  renderDisambiguationPage,
  renderFeaturedArticle,
  renderMissingPage,
  renderNotFoundPage,
  renderPreviewArticle,
  renderSearchResults,
  renderSummaryList,
  renderUpdateList,
} from "./lib/renderers.js";

const homePageModel = buildHomePageModel({ articles, siteConfig });
const wikiGraph = buildWikiGraph(articles);

const elements = {
  pageHeading: document.getElementById("page-heading"),
  pageLead: document.getElementById("page-lead"),
  welcomeSummary: document.getElementById("welcome-summary"),
  featuredStatus: document.getElementById("featured-status"),
  previewStatus: document.getElementById("preview-status"),
  featuredArticle: document.getElementById("featured-article"),
  newArticles: document.getElementById("new-articles"),
  recentUpdates: document.getElementById("recent-updates"),
  categoryGrid: document.getElementById("category-grid"),
  previewArticle: document.getElementById("article-preview-card"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  searchResults: document.getElementById("search-results"),
  randomButton: document.getElementById("random-button"),
  homeView: document.getElementById("home-view"),
  detailView: document.getElementById("detail-view"),
};

const state = {
  featuredEntry: homePageModel.featuredEntry,
  previewEntry: homePageModel.previewEntry,
  route: parseAppRoute(window.location.hash),
};

function renderWelcomeSummary() {
  const { articleCount, categoryCount, latestUpdatedDate } = homePageModel.stats;
  const fallbackNote = contentBuildInfo.usingSamplesFallback
    ? "（現在はサンプル記事を表示しています）"
    : "";
  elements.welcomeSummary.textContent =
    `現在 ${articleCount} 件の記事と ${categoryCount} つのカテゴリがあります。` +
    ` 最終更新: ${formatDisplayDate(latestUpdatedDate)}。${fallbackNote}`;
}

function renderFeaturedState() {
  elements.featuredArticle.innerHTML = renderFeaturedArticle(state.featuredEntry);
  elements.featuredStatus.textContent = `選り抜き記事として「${state.featuredEntry.title}」を表示しています。`;
}

function renderPreviewState() {
  elements.previewArticle.innerHTML = renderPreviewArticle(state.previewEntry);
  elements.previewStatus.textContent = `記事プレビューとして「${state.previewEntry.title}」を表示しています。`;
}

function renderStaticSections() {
  renderWelcomeSummary();
  renderFeaturedState();
  renderPreviewState();

  elements.newArticles.innerHTML = renderSummaryList(homePageModel.newArticles);
  elements.recentUpdates.innerHTML = renderUpdateList(homePageModel.recentUpdates);
  elements.categoryGrid.innerHTML = renderCategoryCards(homePageModel.categoryCards);
}

function clearSearchResults() {
  elements.searchResults.hidden = true;
  elements.searchResults.innerHTML = "";
}

function updateSearchResults(query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    clearSearchResults();
    return;
  }

  const matches = searchArticles(articles, trimmedQuery);
  elements.searchResults.hidden = false;
  elements.searchResults.innerHTML = renderSearchResults(trimmedQuery, matches);
}

function setPreviewEntry(entry) {
  if (!entry) {
    return;
  }

  state.previewEntry = entry;
  renderPreviewState();
}

function setFeaturedEntry(entry) {
  if (!entry) {
    return;
  }

  state.featuredEntry = entry;
  renderFeaturedState();
}

function updatePageHeader(route) {
  if (route.view === "article") {
    const pageModel = buildArticlePageModel(wikiGraph, route.entryId);
    if (pageModel) {
      elements.pageHeading.textContent = pageModel.title;
      elements.pageLead.textContent = pageModel.summary || `${pageModel.category}の記事です。`;
      document.title = `${pageModel.title} - WikiLikePages`;
      return;
    }
  }

  if (route.view === "missing") {
    elements.pageHeading.textContent = `${route.title} (未作成)`;
    elements.pageLead.textContent = "未作成記事の案内ページです。参照元と近い既存ページを確認できます。";
    document.title = `${route.title} - 未作成記事 - WikiLikePages`;
    return;
  }

  if (route.view === "disambiguation") {
    elements.pageHeading.textContent = `${route.title} (曖昧な名称)`;
    elements.pageLead.textContent = "複数候補に分岐する名称の案内ページです。";
    document.title = `${route.title} - 曖昧な名称 - WikiLikePages`;
    return;
  }

  if (route.view === "category") {
    elements.pageHeading.textContent = route.category;
    elements.pageLead.textContent = `「${route.category}」カテゴリの記事一覧です。`;
    document.title = `${route.category} - カテゴリ - WikiLikePages`;
    return;
  }

  elements.pageHeading.textContent = "メインページ";
  elements.pageLead.textContent = "架空世界の知識を集め、つなげる百科事典です。";
  document.title = "WikiLikePages";
}

function handleRandomButtonClick() {
  const randomEntry = pickRandomEntry(articles);
  setFeaturedEntry(randomEntry);
  setPreviewEntry(randomEntry);

  if (state.route.view !== "home") {
    window.location.hash = buildArticleHref(randomEntry.id);
  }
}

function scrollToArticleSection(sectionHeading) {
  if (!sectionHeading) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const sectionAnchor = document.getElementById(buildSectionAnchorId(sectionHeading));
  if (sectionAnchor) {
    sectionAnchor.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDetailView(route) {
  if (route.view === "article") {
    const pageModel = buildArticlePageModel(wikiGraph, route.entryId);
    elements.detailView.innerHTML = pageModel
      ? renderArticlePage(pageModel)
      : renderNotFoundPage(route.entryId);

    if (pageModel) {
      requestAnimationFrame(() => {
        scrollToArticleSection(route.sectionHeading);
      });
    }

    return;
  }

  if (route.view === "missing") {
    elements.detailView.innerHTML = renderMissingPage(
      buildMissingPageModel(wikiGraph, route.title)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (route.view === "disambiguation") {
    const pageModel = buildDisambiguationPageModel(wikiGraph, route.title);
    elements.detailView.innerHTML = pageModel
      ? renderDisambiguationPage(pageModel)
      : renderNotFoundPage(route.title);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (route.view === "category") {
    elements.detailView.innerHTML = renderCategoryPage(route.category, articles);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderRoute() {
  const route = parseAppRoute(window.location.hash);
  state.route = route;
  updatePageHeader(route);

  const isHomeRoute = route.view === "home";
  elements.homeView.hidden = !isHomeRoute;
  elements.detailView.hidden = isHomeRoute;

  if (!isHomeRoute) {
    renderDetailView(route);
  }
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    updateSearchResults(elements.searchInput.value);
  });

  elements.searchInput.addEventListener("input", () => {
    updateSearchResults(elements.searchInput.value);
  });

  elements.randomButton.addEventListener("click", handleRandomButtonClick);
  window.addEventListener("hashchange", renderRoute);

  elements.detailView.addEventListener("click", (event) => {
    const tocLink = event.target.closest(".toc__list a");
    if (!tocLink) {
      return;
    }

    event.preventDefault();
    const targetId = tocLink.getAttribute("href")?.slice(1);
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
  });
}

renderStaticSections();
clearSearchResults();
bindEvents();
renderRoute();
