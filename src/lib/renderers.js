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

function renderEntryLink(entry, options = {}) {
  const href = options.heading
    ? buildArticleHref(entry.id, options.heading)
    : buildArticleHref(entry.id);
  const className = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  const label = options.label ?? entry.title;

  return `<a${className} href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

export function renderInlineMarkdown(escapedText) {
  return escapedText
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/&#39;&#39;&#39;(.+?)&#39;&#39;&#39;/g, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/&#39;&#39;(.+?)&#39;&#39;/g, "<em>$1</em>")
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+?)_/g, "<em>$1</em>")
    .replace(/`([^`\n]+?)`/g, '<code class="inline-code">$1</code>')
    .replace(
      /\[([^\]]+?)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" class="external-link" rel="noopener noreferrer">$1</a>'
    )
    .replace(
      /&lt;(https?:\/\/[^\s&]+?)&gt;/g,
      '<a href="$1" class="external-link" rel="noopener noreferrer">$1</a>'
    )
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
        return `<img class="embed-image" src="content/${escapeHtml(segment.src)}" alt="${escapeHtml(segment.alt)}" loading="lazy">`;
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

function isListItemSegments(segments) {
  return segments.length > 0 && segments[0].type === "text" && segments[0].value.startsWith("・");
}

function stripListMarker(segments) {
  const first = segments[0];
  const stripped = { ...first, value: first.value.slice(1) };
  return [stripped, ...segments.slice(1)];
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
        ? renderInlineMarkdown(renderParagraphSegments(note.segments))
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

    parts.push(
      `<ul class="plain-list">${listBuffer
        .map((segments) => `<li>${renderParagraphSegments(stripListMarker(segments))}</li>`)
        .join("")}</ul>`
    );
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

    if (Array.isArray(segments) && isListItemSegments(segments)) {
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
          <p>${escapeHtml(category.description)}</p>
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

function renderInfoboxRowSegments(segments) {
  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return renderInlineMarkdown(escapeHtml(segment.value));
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
}

export function renderInfobox(model) {
  const headingHtml = model.heading
    ? `<caption class="infobox__heading">${escapeHtml(model.heading)}</caption>`
    : "";

  const rowsHtml = model.rows
    .map((row) => {
      const valueHtml = row.segments
        ? renderInfoboxRowSegments(row.segments)
        : escapeHtml(row.value);

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
      <tbody>${rowsHtml}</tbody>
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
