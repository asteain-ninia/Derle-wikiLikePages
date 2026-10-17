import { formatDisplayDate } from "./home-page-model.js";
import { buildArticleHref } from "./article-page-model.js";

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

// content/ からの相対パス (日本語・空白を含みうる) を img の src 用 URL にする
function buildAssetUrl(contentRelativePath) {
  return `content/${contentRelativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function renderEntryLink(entry, options = {}) {
  const href = options.heading
    ? buildArticleHref(entry.id, options.heading)
    : buildArticleHref(entry.id);
  const className = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  const label = options.label ?? entry.title;

  return `<a${className} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

const PLACEHOLDER_PATTERN = /(\d+)/g;
const PLACEHOLDER_DELIMITERS = /[]/g;

function restorePlaceholders(text, heldParts) {
  let restored = text;
  // 保護した断片の中に別の保護断片が入れ子になることがあるため、残らなくなるまで戻す。
  // 入力側の区切り文字は事前に除去済みなので、ここに残るのは自分で作ったものだけ。
  while (restored.search(PLACEHOLDER_PATTERN) !== -1) {
    restored = restored.replace(PLACEHOLDER_PATTERN, (_match, index) => heldParts[Number(index)] ?? "");
  }
  return restored;
}

export function renderInlineMarkdown(escapedText) {
  const heldParts = [];
  const hold = (html) => {
    heldParts.push(html);
    return `${heldParts.length - 1}`;
  };

  // 入力はエスケープ済みなので、ここにある < はすべて生成済みのタグ (<a>, <img> など)。
  // 属性値・コード・URL を書式変換の対象から外すため、先に退避してから強調記法を処理する。
  const formatted = escapedText
    .replace(PLACEHOLDER_DELIMITERS, "")
    .replace(/<[^>]*>/g, (tag) => hold(tag))
    .replace(/`([^`\n]+?)`/g, (_match, code) => hold(`<code class="inline-code">${code}</code>`))
    .replace(
      /\[([^\]]+?)\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, label, url) =>
        `${hold(`<a href="${url}" class="external-link" rel="noopener noreferrer">`)}${label}${hold("</a>")}`
    )
    .replace(/&lt;(https?:\/\/[^\s&]+?)&gt;/g, (_match, url) =>
      hold(`<a href="${url}" class="external-link" rel="noopener noreferrer">${url}</a>`)
    )
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/&#39;&#39;&#39;(.+?)&#39;&#39;&#39;/g, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\p{L}\p{N}_])__(.+?)__(?![\p{L}\p{N}_])/gu, "$1<strong>$2</strong>")
    .replace(/&#39;&#39;(.+?)&#39;&#39;/g, "<em>$1</em>")
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+?)_(?![\p{L}\p{N}_])/gu, "$1<em>$2</em>");

  return restorePlaceholders(formatted, heldParts)
    .replace(/&lt;(small|sup|sub)&gt;/gi, "<$1>")
    .replace(/&lt;\/(small|sup|sub)&gt;/gi, "</$1>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/\uE010/g, "[")
    .replace(/\uE011/g, "]")
    .replace(/\uE012/g, "{")
    .replace(/\uE013/g, "}")
    .replace(/\uE014/g, "&#39;")
    .replace(/\uE015/g, "&#42;")
    .replace(/\uE016/g, "&#96;")
    .replace(/\uE017/g, "&#95;");
}

function renderRelatedTitles(titles) {
  return titles.map((title) => `<li>${escapeHtml(title)}</li>`).join("");
}

function renderParagraphSegments(segments) {
  const raw = segments
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtml(segment.value);
      }

      if (segment.type === "embed") {
        return `<img class="embed-image" src="${escapeHtml(buildAssetUrl(segment.src))}" alt="${escapeHtml(segment.alt)}" loading="lazy">`;
      }

      const classNames = ["wiki-link"];
      if (segment.status === "missing") {
        classNames.push("wiki-link--missing");
      } else if (segment.status === "ambiguous") {
        classNames.push("wiki-link--ambiguous");
      }

      return `<a class="${classNames.join(" ")}" href="${escapeHtml(segment.href)}">${escapeHtml(segment.label)}</a>`;
    })
    .join("");

  return renderInlineMarkdown(raw);
}

function renderList(items) {
  // MediaWiki と同じく、各項目のマーカー列 ("*", "#", "#*" ...) と開いているリストの
  // スタックを先頭から比べ、食い違う階層を閉じてから足りない階層を開く。
  const openTags = [];
  let html = "";

  for (const item of items) {
    const tags = [...item.markers].map((marker) => (marker === "#" ? "ol" : "ul"));
    let commonDepth = 0;
    while (
      commonDepth < openTags.length &&
      commonDepth < tags.length &&
      openTags[commonDepth] === tags[commonDepth]
    ) {
      commonDepth += 1;
    }

    while (openTags.length > commonDepth) {
      html += `</li></${openTags.pop()}>`;
    }

    if (openTags.length === tags.length) {
      html += "</li>";
    }

    while (openTags.length < tags.length) {
      const tag = tags[openTags.length];
      html += `<${tag} class="plain-list">`;
      openTags.push(tag);
      // 階層を飛ばした入力 (* の直後の *** など) では、リスト直下にリストが来ないよう空の項目で包む
      if (openTags.length < tags.length) {
        html += "<li>";
      }
    }

    const content = item.bodySegments
      ? renderParagraphSegments(item.bodySegments)
      : renderInlineMarkdown(escapeHtml(item.body));
    html += `<li>${content}`;
  }

  while (openTags.length > 0) {
    html += `</li></${openTags.pop()}>`;
  }

  return html;
}

function renderWikiTable(tableModel) {
  const captionHtml = tableModel.caption
    ? `<caption>${renderInlineMarkdown(escapeHtml(tableModel.caption))}</caption>`
    : "";

  const rowsHtml = tableModel.rows
    .map((row) => {
      const cellsHtml = row
        .map((cell) => {
          const tag = cell.isHeader ? "th" : "td";
          const attrs = [];
          if (cell.rowspan && cell.rowspan > 1) {
            attrs.push(`rowspan="${cell.rowspan}"`);
          }
          if (cell.colspan && cell.colspan > 1) {
            attrs.push(`colspan="${cell.colspan}"`);
          }
          const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
          const content = cell.segments
            ? renderParagraphSegments(cell.segments)
            : renderInlineMarkdown(escapeHtml(cell.text));
          return `<${tag}${attrStr}>${content}</${tag}>`;
        })
        .join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    .join("");

  return `<table class="wikitable">${captionHtml}<tbody>${rowsHtml}</tbody></table>`;
}

function renderBlockquote(blockquoteModel) {
  const content = blockquoteModel.bodySegments
    ? renderParagraphSegments(blockquoteModel.bodySegments)
    : renderInlineMarkdown(escapeHtml(blockquoteModel.body));
  return `<blockquote class="wiki-blockquote">${content}</blockquote>`;
}

function renderDefinitionList(model) {
  const itemsHtml = model.items
    .map((item) => {
      const termHtml = item.termSegments
        ? renderParagraphSegments(item.termSegments)
        : renderInlineMarkdown(escapeHtml(item.term));
      const descHtml = item.descriptionSegments
        ? renderParagraphSegments(item.descriptionSegments)
        : renderInlineMarkdown(escapeHtml(item.description));
      return `<dt>${termHtml}</dt><dd>${descHtml}</dd>`;
    })
    .join("");
  return `<dl class="wiki-dl">${itemsHtml}</dl>`;
}

function renderPoem(model) {
  const content = model.bodySegments
    ? renderParagraphSegments(model.bodySegments)
    : renderInlineMarkdown(escapeHtml(model.body));
  return `<div class="poem">${content}</div>`;
}

function renderCodeBlock(model) {
  const langAttr = model.language ? ` data-language="${escapeHtml(model.language)}"` : "";
  return `<pre class="code-block"${langAttr}><code>${escapeHtml(model.body)}</code></pre>`;
}

export function renderFootnotes(footnotes) {
  if (!footnotes || footnotes.length === 0) {
    return "";
  }

  const items = footnotes
    .map((note, index) => {
      const body = note.segments
        ? renderParagraphSegments(note.segments)
        : renderInlineMarkdown(escapeHtml(note));
      return `<li id="fn-${index + 1}"><span class="footnote__number">[${index + 1}]</span> ${body}</li>`;
    })
    .join("");

  return `
    <section class="footnotes" aria-label="脚注">
      <h3>脚注</h3>
      <ol class="footnotes__list">${items}</ol>
    </section>
  `;
}

function renderCallout(calloutParagraph) {
  const styleMap = {
    warning: "callout--warning",
    caution: "callout--warning",
    tip: "callout--tip",
    hint: "callout--tip",
    important: "callout--important",
    danger: "callout--important",
  };
  const styleClass = styleMap[calloutParagraph.calloutType] ?? "";
  const classAttr = styleClass ? ` ${styleClass}` : "";

  return `
    <aside class="callout${classAttr}" role="note">
      <p class="callout__title">${escapeHtml(calloutParagraph.title)}</p>
      <p>${renderParagraphSegments(calloutParagraph.bodySegments)}</p>
    </aside>
  `;
}

function renderSectionParagraphs(paragraphs) {
  const parts = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length === 0) {
      return;
    }

    parts.push(renderList(listBuffer));
    listBuffer = [];
  }

  for (const segments of paragraphs) {
    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "callout") {
      flushList();
      parts.push(renderCallout(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "table") {
      flushList();
      parts.push(renderWikiTable(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "blockquote") {
      flushList();
      parts.push(renderBlockquote(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "main-article") {
      flushList();
      const linkHtml = segments.segments
        ? renderParagraphSegments(segments.segments)
        : escapeHtml(segments.articleName);
      parts.push(`<p class="main-article-link">詳細は「${linkHtml}」を参照。</p>`);
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "definition-list") {
      flushList();
      parts.push(renderDefinitionList(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "hr") {
      flushList();
      parts.push("<hr>");
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "poem") {
      flushList();
      parts.push(renderPoem(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "code-block") {
      flushList();
      parts.push(renderCodeBlock(segments));
      continue;
    }

    if (segments && typeof segments === "object" && !Array.isArray(segments) && segments.type === "list-item") {
      listBuffer.push(segments);
      continue;
    }

    flushList();
    if (Array.isArray(segments)) {
      parts.push(`<p>${renderParagraphSegments(segments)}</p>`);
    }
  }

  flushList();
  return parts.join("");
}

function renderEntrySummaryLinks(entries) {
  if (entries.length === 0) {
    return '<p class="empty-note">まだ項目がありません。</p>';
  }

  return `
    <ul class="plain-list">
      ${entries
        .map((entry) => {
          return `
            <li>
              ${renderEntryLink(entry)}
              <span class="entry-inline-meta"> (${escapeHtml(entry.category)} / ${escapeHtml(formatDisplayDate(entry.updated))})</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function renderTableOfContents(sections) {
  const headings = sections.filter((section) => section.heading !== "概要");
  if (headings.length < 2) {
    return "";
  }

  const items = headings
    .map(
      (section) =>
        `<li><a href="#${escapeHtml(section.anchorId)}">${escapeHtml(section.heading)}</a></li>`
    )
    .join("");

  return `
    <nav class="toc" aria-labelledby="toc-heading">
      <h3 id="toc-heading">目次</h3>
      <ol class="toc__list">${items}</ol>
    </nav>
  `;
}

function renderTagList(tags) {
  if (tags.length === 0) {
    return '<p class="empty-note">タグはまだ設定されていません。</p>';
  }

  return `
    <ul class="tag-list" aria-label="タグ一覧">
      ${tags
        .map(
          (tag) =>
            `<li><a class="tag" href="#!category/${encodeURIComponent(tag)}">${escapeHtml(tag)}</a></li>`
        )
        .join("")}
    </ul>
  `;
}

export function renderFeaturedArticle(entry) {
  if (!entry) {
    return "<p>表示できる記事がありません。</p>";
  }

  return `
    <h3>${renderEntryLink(entry)}</h3>
    <p class="entry-meta">${escapeHtml(entry.category)} / 最終更新 ${escapeHtml(formatDisplayDate(entry.updated))}</p>
    <p>${escapeHtml(entry.summary)}</p>
    <p class="small-links">キーワード: ${entry.keywords.map((keyword) => escapeHtml(keyword)).join(" / ")}</p>
  `;
}

export function renderPreviewArticle(entry) {
  if (!entry) {
    return "<p>記事プレビューを表示できません。</p>";
  }

  return `
    <header class="preview-article__header">
      <h3>${renderEntryLink(entry)}</h3>
      <p class="entry-meta">
        ${escapeHtml(entry.category)} / 作成 ${escapeHtml(formatDisplayDate(entry.created))} / 更新 ${escapeHtml(formatDisplayDate(entry.updated))}
      </p>
    </header>
    <p>${escapeHtml(entry.preview)}</p>
    <p class="preview-article__keywords">キーワード: ${entry.keywords.map((keyword) => escapeHtml(keyword)).join(", ")}</p>
    <section class="preview-article__related" aria-label="関連ページ">
      <h4>関連ページ</h4>
      <ul class="plain-list">
        ${renderRelatedTitles(entry.relatedTitles)}
      </ul>
    </section>
  `;
}

export function renderSummaryList(entries) {
  if (entries.length === 0) {
    return "<li>記事がありません。</li>";
  }

  return entries
    .map(
      (entry) => `
        <li>
          ${renderEntryLink(entry)}
          <span> - ${escapeHtml(entry.summary)}</span>
        </li>
      `
    )
    .join("");
}

export function renderUpdateList(entries) {
  if (entries.length === 0) {
    return "<li>更新情報がありません。</li>";
  }

  return entries
    .map(
      (entry) => `
        <li>
          <p class="entry-list__headline">${renderEntryLink(entry)}</p>
          <p class="entry-list__meta">${escapeHtml(entry.category)} / 最終更新 ${escapeHtml(formatDisplayDate(entry.updated))}</p>
        </li>
      `
    )
    .join("");
}

export function renderSearchResults(query, matches) {
  const safeQuery = escapeHtml(query.trim());

  if (matches.length === 0) {
    return `
      <h2>検索結果</h2>
      <p>「${safeQuery}」に一致するサンプル記事はありません。</p>
    `;
  }

  return `
    <h2>検索結果</h2>
    <p class="search-results__count">「${safeQuery}」に一致する記事が ${matches.length} 件あります。</p>
    <ul class="entry-list">
      ${matches
        .map(
          (entry) => `
            <li>
              ${renderEntryLink(entry)}
              <span> (${escapeHtml(entry.category)}) - ${escapeHtml(entry.summary)}</span>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

export function renderCategoryCards(categoryCards) {
  return categoryCards
    .map(
      (category) => `
        <a class="category-card" href="#!category/${encodeURIComponent(category.name)}">
          <h3>${escapeHtml(category.name)}</h3>
          <p class="category-card__count">記事数 ${category.articleCount}</p>
          ${category.description ? `<p>${escapeHtml(category.description)}</p>` : ""}
        </a>
      `
    )
    .join("");
}

export function renderCategoryPage(categoryName, articles) {
  const filtered = articles
    .filter((entry) => entry.category === categoryName || (entry.tags ?? []).includes(categoryName))
    .sort((a, b) => a.title.localeCompare(b.title, "ja-JP"));

  const articleListHtml =
    filtered.length === 0
      ? '<p class="empty-note">このカテゴリに該当する記事はまだありません。</p>'
      : `<ul class="category-article-list">${filtered
          .map(
            (entry) => `
              <li>
                <a class="wiki-link" href="${buildArticleHref(entry.id)}">${escapeHtml(entry.title)}</a>
                <span class="entry-meta"> — ${escapeHtml(entry.summary || "")}</span>
              </li>
            `
          )
          .join("")}</ul>`;

  return `
    <article class="article-page">
      <nav class="breadcrumbs" aria-label="パンくず">
        <a href="#overview">メインページ</a>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>カテゴリ</span>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>${escapeHtml(categoryName)}</span>
      </nav>

      <header class="article-page__header">
        <p class="article-page__eyebrow">カテゴリ</p>
        <h2>${escapeHtml(categoryName)}</h2>
        <p class="article-page__summary">「${escapeHtml(categoryName)}」カテゴリの記事一覧です。（${filtered.length} 件）</p>
      </header>

      <div class="article-page__body" style="padding: 18px 20px;">
        ${articleListHtml}
      </div>
    </article>
  `;
}

function renderHistory(history) {
  if (!history || history.length === 0) {
    return '<p class="empty-note">履歴情報はありません。</p>';
  }

  return `
    <ul class="history-list">
      ${history
        .map(
          (entry) =>
            `<li>
              <span class="history-date">${escapeHtml(formatDisplayDate(entry.date))}</span>
              <span class="history-message">${escapeHtml(entry.message)}</span>
            </li>`
        )
        .join("")}
    </ul>
  `;
}

export function renderArticlePage(pageModel) {
  return `
    <article class="article-page">
      <nav class="breadcrumbs" aria-label="パンくず">
        <a href="#overview">メインページ</a>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>${escapeHtml(pageModel.category)}</span>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>${escapeHtml(pageModel.title)}</span>
      </nav>

      <header class="article-page__header">
        <p class="article-page__eyebrow">${escapeHtml(pageModel.category)}</p>
        <h2>${escapeHtml(pageModel.title)}</h2>
        <p class="article-page__summary">${escapeHtml(pageModel.summary)}</p>
        <p class="entry-meta">
          作成 ${escapeHtml(formatDisplayDate(pageModel.created))} / 更新 ${escapeHtml(formatDisplayDate(pageModel.updated))}
        </p>
      </header>

      ${renderNotices(pageModel.templateModels)}

      ${renderTableOfContents(pageModel.sections)}

      <div class="article-page__layout">
        <div class="article-page__body">
          ${pageModel.sections
            .map((section) => {
              return `
                <section class="article-section" id="${escapeHtml(section.anchorId)}">
                  <h3>${escapeHtml(section.heading)}</h3>
                  ${renderSectionParagraphs(section.paragraphs)}
                </section>
              `;
            })
            .join("")}
          ${renderFootnotes(pageModel.footnotes)}
        </div>

        <aside class="article-page__sidebar">
          ${renderInfoboxes(pageModel.templateModels)}

          <section class="article-sidebox">
            <h3>タグ</h3>
            ${renderTagList(pageModel.tags)}
          </section>

          <section class="article-sidebox">
            <h3>別名</h3>
            ${
              pageModel.aliases.length === 0
                ? '<p class="empty-note">別名は登録されていません。</p>'
                : `<ul class="plain-list">${pageModel.aliases
                    .map((alias) => `<li>${escapeHtml(alias)}</li>`)
                    .join("")}</ul>`
            }
          </section>

          <section class="article-sidebox">
            <h3>更新履歴</h3>
            ${renderHistory(pageModel.history)}
          </section>

          <section class="article-sidebox">
            <h3>バックリンク</h3>
            ${renderEntrySummaryLinks(pageModel.backlinks)}
          </section>

          <section class="article-sidebox">
            <h3>リンク状況</h3>
            <p class="article-page__status">
              未作成または曖昧なリンクは ${pageModel.unresolvedLinkCount} 件です。
            </p>
          </section>
        </aside>
      </div>
    </article>
  `;
}

export function renderMissingPage(pageModel) {
  return `
    <article class="article-page article-page--missing">
      <nav class="breadcrumbs" aria-label="パンくず">
        <a href="#overview">メインページ</a>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>未作成記事</span>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>${escapeHtml(pageModel.title)}</span>
      </nav>

      <header class="article-page__header">
        <p class="article-page__eyebrow">未作成記事</p>
        <h2>${escapeHtml(pageModel.title)}</h2>
        <p class="article-page__summary">
          この項目はまだ記事として作成されていません。参照元と近い既存ページを確認し、必要なら原稿化してください。
        </p>
      </header>

      <div class="article-page__layout">
        <div class="article-page__body">
          <section class="article-section">
            <h3>参照元ページ</h3>
            ${renderEntrySummaryLinks(pageModel.sourceEntries)}
          </section>

          <section class="article-section">
            <h3>記事を作成する</h3>
            <p>
              <code>content/</code> 配下に原稿ファイル（例: <code>${escapeHtml(pageModel.title)}.wiki</code>）を置き、
              <code>npm run build:content</code> を実行するとこのページが記事になります。
            </p>
          </section>
        </div>

        <aside class="article-page__sidebar">
          <section class="article-sidebox">
            <h3>近い既存ページ</h3>
            ${renderEntrySummaryLinks(pageModel.suggestions)}
          </section>
        </aside>
      </div>
    </article>
  `;
}

export function renderDisambiguationPage(pageModel) {
  return `
    <article class="article-page article-page--disambiguation">
      <nav class="breadcrumbs" aria-label="パンくず">
        <a href="#overview">メインページ</a>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>曖昧な名称</span>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>${escapeHtml(pageModel.title)}</span>
      </nav>

      <header class="article-page__header">
        <p class="article-page__eyebrow">曖昧な名称</p>
        <h2>${escapeHtml(pageModel.title)}</h2>
        <p class="article-page__summary">
          この名称は複数の記事候補に対応しています。対象ページを選び直してください。
        </p>
      </header>

      <div class="article-page__layout">
        <div class="article-page__body">
          <section class="article-section">
            <h3>候補ページ</h3>
            ${
              pageModel.candidates.length === 0
                ? '<p class="empty-note">候補ページを表示できません。</p>'
                : `<ul class="entry-list entry-list--stacked">${pageModel.candidates
                    .map((entry) => {
                      return `
                        <li>
                          <p class="entry-list__headline">${renderEntryLink(entry)}</p>
                          <p class="entry-list__meta">${escapeHtml(entry.category)} / 最終更新 ${escapeHtml(formatDisplayDate(entry.updated))}</p>
                          <p>${escapeHtml(entry.summary)}</p>
                        </li>
                      `;
                    })
                    .join("")}</ul>`
            }
          </section>
        </div>

        <aside class="article-page__sidebar">
          <section class="article-sidebox">
            <h3>参照元ページ</h3>
            ${renderEntrySummaryLinks(pageModel.sourceEntries)}
          </section>
        </aside>
      </div>
    </article>
  `;
}

export function renderNotFoundPage(label) {
  return `
    <article class="article-page article-page--missing">
      <nav class="breadcrumbs" aria-label="パンくず">
        <a href="#overview">メインページ</a>
        <span class="breadcrumbs__separator" aria-hidden="true">/</span>
        <span>ページ未検出</span>
      </nav>

      <header class="article-page__header">
        <p class="article-page__eyebrow">ページ未検出</p>
        <h2>${escapeHtml(label)}</h2>
        <p class="article-page__summary">
          指定されたページは現在のサンプルデータに存在しません。メインページから辿り直してください。
        </p>
      </header>
    </article>
  `;
}

export function renderInfobox(model) {
  const headingHtml = model.heading
    ? `<caption class="infobox__heading">${escapeHtml(model.heading)}</caption>`
    : "";

  const imagesHtml = (model.images ?? [])
    .map(
      (image) => `
        <tr>
          <td class="infobox__image" colspan="2">
            <img src="${escapeHtml(buildAssetUrl(image.src))}" alt="${escapeHtml(image.caption || image.src)}" loading="lazy">
            ${image.caption ? `<div class="infobox__caption">${escapeHtml(image.caption)}</div>` : ""}
          </td>
        </tr>
      `
    )
    .join("");

  const rowsHtml = model.rows
    .map((row) => {
      // 値の中の改行 (テンプレート内で折り返した行) は <br> にする
      const valueHtml = (row.segments
        ? renderParagraphSegments(row.segments)
        : renderInlineMarkdown(escapeHtml(row.value))
      ).replace(/\n/g, "<br>");

      return `
        <tr>
          <th class="infobox__label">${escapeHtml(row.label)}</th>
          <td class="infobox__value">${valueHtml}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="infobox" role="presentation">
      ${headingHtml}
      <tbody>${imagesHtml}${rowsHtml}</tbody>
    </table>
  `;
}

export function renderNotice(model) {
  const styleClass = model.style ? ` notice--${escapeHtml(model.style)}` : "";
  return `
    <aside class="notice${styleClass}" role="note">
      <p>${escapeHtml(model.text)}</p>
    </aside>
  `;
}

function renderNotices(templateModels) {
  if (!templateModels) {
    return "";
  }

  return templateModels
    .filter((model) => model.type === "notice")
    .map((model) => renderNotice(model))
    .join("");
}

function renderInfoboxes(templateModels) {
  if (!templateModels) {
    return "";
  }

  return templateModels
    .filter((model) => model.type === "infobox")
    .map((model) => renderInfobox(model))
    .join("");
}

export function renderTemplateModels(templateModels) {
  if (!templateModels || templateModels.length === 0) {
    return "";
  }

  return templateModels
    .map((model) => {
      if (model.type === "infobox") {
        return renderInfobox(model);
      }

      if (model.type === "notice") {
        return renderNotice(model);
      }

      return "";
    })
    .join("");
}
