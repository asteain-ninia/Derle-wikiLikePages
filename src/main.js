import { articles, imageSizes } from "./data/articles.js";
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
  renderMaintenanceReportPage,
  renderPreviewArticle,
  renderSearchResults,
  renderSummaryList,
  renderUpdateList,
  setImageSizes,
} from "./lib/renderers.js";

import { mountLoomCalculators } from "./lib/loom/widgets.js";

const SITE_NAME = siteConfig.siteName;

setImageSizes(imageSizes);

const homePageModel = buildHomePageModel({ articles, siteConfig });
const wikiGraph = buildWikiGraph(articles);

const elements = {
  pageHeading: document.getElementById("page-heading"),
  pageLead: document.getElementById("page-lead"),
  welcomeSummary: document.getElementById("welcome-summary"),
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
  elements.welcomeSummary.textContent =
    `現在 ${articleCount} 件の記事と ${categoryCount} つのカテゴリがあります。` +
    ` 最終更新: ${formatDisplayDate(latestUpdatedDate)}。`;
}

function renderFeaturedState() {
  elements.featuredArticle.innerHTML = renderFeaturedArticle(state.featuredEntry);
}

function renderPreviewState() {
  elements.previewArticle.innerHTML = renderPreviewArticle(state.previewEntry);
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
      document.title = `${pageModel.title} - ${SITE_NAME}`;
      return;
    }
  }

  if (route.view === "missing") {
    elements.pageHeading.textContent = `${route.title} (未作成)`;
    elements.pageLead.textContent = "まだ記事になっていない項目です。";
    document.title = `${route.title} - 未作成記事 - ${SITE_NAME}`;
    return;
  }

  if (route.view === "disambiguation") {
    elements.pageHeading.textContent = `${route.title} (曖昧な名称)`;
    elements.pageLead.textContent = "複数の記事にあてはまる名前です。";
    document.title = `${route.title} - 曖昧な名称 - ${SITE_NAME}`;
    return;
  }

  if (route.view === "category") {
    elements.pageHeading.textContent = route.category;
    elements.pageLead.textContent = `「${route.category}」カテゴリの記事一覧です。`;
    document.title = `${route.category} - カテゴリ - ${SITE_NAME}`;
    return;
  }

  if (route.view === "maintenance") {
    elements.pageHeading.textContent = "保守レポート";
    elements.pageLead.textContent = "記事どうしのリンクのつながりをまとめたものです。";
    document.title = `保守レポート - ${SITE_NAME}`;
    return;
  }

  elements.pageHeading.textContent = "メインページ";
  elements.pageLead.textContent = "出界の百科事典です。";
  document.title = SITE_NAME;
}

function handleRandomButtonClick() {
  const randomEntry = pickRandomEntry(articles);
  setFeaturedEntry(randomEntry);
  setPreviewEntry(randomEntry);

  if (state.route.view !== "home") {
    window.location.hash = buildArticleHref(randomEntry.id);
  }
}

let stopFollowingScrollTarget = () => {};

// 節へ移動する。移動のあとで上にある画像が読み込まれると節が下へずれるので、
// 画像が読み込まれるたびに合わせ直す。読者が自分でスクロールしたら (または 5 秒たったら) やめる
function scrollToElement(target) {
  stopFollowingScrollTarget();
  const align = () => target.scrollIntoView({ block: "start" });
  align();

  const pendingImages = [...elements.detailView.querySelectorAll("img")].filter((image) => !image.complete);
  if (pendingImages.length === 0) {
    return;
  }

  const userEvents = ["wheel", "touchstart", "keydown", "mousedown"];
  const timer = setTimeout(() => stopFollowingScrollTarget(), 5000);
  stopFollowingScrollTarget = () => {
    clearTimeout(timer);
    for (const image of pendingImages) {
      image.removeEventListener("load", align);
    }
    for (const type of userEvents) {
      window.removeEventListener(type, stopFollowingScrollTarget);
    }
    stopFollowingScrollTarget = () => {};
  };
  for (const image of pendingImages) {
    image.addEventListener("load", align);
  }
  for (const type of userEvents) {
    window.addEventListener(type, stopFollowingScrollTarget, { passive: true });
  }
}

function scrollToArticleSection(sectionHeading) {
  const sectionAnchor = sectionHeading
    ? document.getElementById(buildSectionAnchorId(sectionHeading))
    : null;
  if (sectionAnchor) {
    scrollToElement(sectionAnchor);
    return;
  }

  stopFollowingScrollTarget();
  window.scrollTo({ top: 0 });
}

function renderDetailView(route) {
  if (route.view === "article") {
    const pageModel = buildArticlePageModel(wikiGraph, route.entryId);
    elements.detailView.innerHTML = pageModel
      ? renderArticlePage(pageModel)
      : renderNotFoundPage(route.entryId);

    if (pageModel) {
      mountLoomCalculators(elements.detailView);
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
    return;
  }

  if (route.view === "maintenance") {
    elements.detailView.innerHTML = renderMaintenanceReportPage(null, { loading: true });
    window.scrollTo({ top: 0 });
    loadMaintenanceReport().then((report) => {
      if (state.route.view === "maintenance") {
        elements.detailView.innerHTML = renderMaintenanceReportPage(report);
      }
    });
  }
}

// build:content が書き出した保守レポート。公開サイトでも src/ ごと配信されるので同じ場所から読める
async function loadMaintenanceReport() {
  try {
    const response = await fetch("src/data/generated/maintenance-report.json", { cache: "no-cache" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
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

function isCurrentHash(href) {
  try {
    return decodeURIComponent(href) === decodeURIComponent(window.location.hash);
  } catch {
    return href === window.location.hash;
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
    // いま開いている節へのリンクをもう一度押しても URL が変わらず hashchange が起きないので、
    // 自分で節へ移動し直す (Wikipedia で同じ見出しリンクを何度押しても飛ぶのと同じにする)
    const articleLink = event.target.closest('a[href^="#!article/"]');
    if (articleLink && isCurrentHash(articleLink.getAttribute("href"))) {
      event.preventDefault();
      scrollToArticleSection(state.route.sectionHeading);
      return;
    }

    // ページ内の id へのリンク (目次の #section-…、脚注番号の #fn-…) は、ハッシュを変えると
    // ルーティングがメインページへ戻ってしまうので、自分で移動する。移動先が無ければ何もしない。
    // 移動先がメインページ側の要素 (パンくずの #overview) なら、これまでどおりブラウザに任せる
    const inPageLink = event.target.closest('a[href^="#"]:not([href^="#!"])');
    if (!inPageLink) {
      return;
    }

    const target = document.getElementById(inPageLink.getAttribute("href").slice(1));
    if (target && !elements.detailView.contains(target)) {
      return;
    }

    event.preventDefault();
    if (target) {
      scrollToElement(target);
    }
  });
}

// 記事の静的ページ (article/…/) の検索欄は ?q=語 を付けてここへ来る。来たら同じ語で検索結果を出す
function applySearchQueryFromUrl() {
  const query = new URLSearchParams(window.location.search).get("q");
  if (query) {
    elements.searchInput.value = query;
    updateSearchResults(query);
  }
}

renderStaticSections();
clearSearchResults();
bindEvents();
renderRoute();
applySearchQueryFromUrl();
