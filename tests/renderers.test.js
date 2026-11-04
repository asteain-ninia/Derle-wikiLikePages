import test from "node:test";
import assert from "node:assert/strict";

import {
  escapeHtml,
  renderArticlePage,
  renderCategoryCards,
  renderCategoryPage,
  renderDisambiguationPage,
  renderFeaturedArticle,
  renderFootnotes,
  renderInfobox,
  renderInlineMarkdown,
  renderMaintenanceReportPage,
  renderMissingPage,
  renderNotFoundPage,
  renderNotice,
  renderPreviewArticle,
  renderSearchResults,
  renderSummaryList,
  renderTemplateModels,
  renderUpdateList,
} from "../src/lib/renderers.js";

const fixtureEntry = {
  id: "entry-1",
  title: '封蝋院 <script>alert("x")</script>',
  category: "組織",
  created: "2026-03-10",
  updated: "2026-03-15",
  summary: "通行証を扱う行政機関",
  preview: "物流と政治の結節点",
  keywords: ["通行証", "行政"],
  relatedTitles: ["白磁海", "潮見港"],
};

test("escapeHtml escapes the five critical HTML characters", () => {
  assert.equal(
    escapeHtml(`&<>"'`),
    "&amp;&lt;&gt;&quot;&#39;"
  );
});

test("renderFeaturedArticle escapes dangerous text and keeps the article route", () => {
  const rendered = renderFeaturedArticle(fixtureEntry);

  assert.match(rendered, /#!article\/entry-1/);
  assert.doesNotMatch(rendered, /<script>/);
  assert.match(rendered, /&lt;script&gt;alert/);
});

test("renderPreviewArticle includes related titles", () => {
  const rendered = renderPreviewArticle(fixtureEntry);

  assert.match(rendered, /関連ページ/);
  assert.match(rendered, /白磁海/);
  assert.match(rendered, /潮見港/);
});

test("renderSummaryList renders fallback text for empty entries", () => {
  assert.match(renderSummaryList([]), /記事がありません/);
});

test("renderUpdateList renders formatted update meta", () => {
  const rendered = renderUpdateList([fixtureEntry]);
  assert.match(rendered, /最終更新 2026\.03\.15/);
});

test("renderSearchResults reports the number of matches", () => {
  const rendered = renderSearchResults("封蝋", [fixtureEntry]);
  assert.match(rendered, /1 件あります/);
});

test("renderCategoryCards renders article counts", () => {
  const rendered = renderCategoryCards([
    { name: "世界設定", description: "desc", articleCount: 2 },
  ]);

  assert.match(rendered, /記事数 2/);
});

test("renderArticlePage marks missing links with wiki-link--missing", () => {
  const rendered = renderArticlePage({
    id: "entry-1",
    title: "白磁海",
    category: "世界設定",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "summary",
    aliases: ["白海"],
    tags: ["地理"],
    unresolvedLinkCount: 1,
    backlinks: [{ id: "entry-2", title: "潮見港", category: "世界設定", updated: "2026-03-14" }],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [
          [
            { type: "text", value: "本文 " },
            {
              type: "link",
              status: "missing",
              href: "#!missing/%E7%99%BD%E7%A3%81%E8%88%AA%E8%B7%AF%E5%8F%B0%E5%B8%B3",
              label: "白磁航路台帳",
              title: "白磁航路台帳",
            },
          ],
        ],
      },
    ],
  });

  assert.match(rendered, /wiki-link--missing/);
  assert.match(rendered, /バックリンク/);
  assert.match(rendered, /未作成または曖昧なリンクは 1 件/);
});

test("renderMissingPage shows source entries and guidance", () => {
  const rendered = renderMissingPage({
    title: "白磁航路台帳",
    sourceEntries: [{ id: "entry-1", title: "白磁海", category: "世界設定", updated: "2026-03-15" }],
    suggestions: [{ id: "entry-2", title: "潮見港", category: "世界設定", updated: "2026-03-14" }],
  });

  assert.match(rendered, /この名前にリンクしている記事/);
  assert.match(rendered, /近い既存ページ/);
  // 読者向けのページなので、原稿の置き方などの作業手順は出さない
  assert.doesNotMatch(rendered, /build:content|\.wiki/);
});

test("renderDisambiguationPage lists candidate pages", () => {
  const rendered = renderDisambiguationPage({
    title: "調査記録",
    candidates: [{ id: "a", title: "調査記録A", category: "年表", updated: "2026-03-12", summary: "A" }],
    sourceEntries: [{ id: "entry-1", title: "白磁海", category: "世界設定", updated: "2026-03-15" }],
  });

  assert.match(rendered, /曖昧な名称/);
  assert.match(rendered, /調査記録A/);
});

test("renderNotFoundPage shows a fallback message", () => {
  const rendered = renderNotFoundPage("missing-id");
  assert.match(rendered, /ページ未検出/);
  assert.match(rendered, /missing-id/);
});

test("renderInlineMarkdown converts **bold** to <strong>", () => {
  assert.equal(renderInlineMarkdown("前 **太字** 後"), "前 <strong>太字</strong> 後");
});

test("renderInlineMarkdown converts *italic* to <em>", () => {
  assert.equal(renderInlineMarkdown("前 *斜体* 後"), "前 <em>斜体</em> 後");
});

test("renderInlineMarkdown converts `code` to <code>", () => {
  assert.equal(
    renderInlineMarkdown("前 `コード` 後"),
    '前 <code class="inline-code">コード</code> 後'
  );
});

test("renderInlineMarkdown converts ***bold italic*** to nested tags", () => {
  assert.equal(
    renderInlineMarkdown("***強調斜体***"),
    "<strong><em>強調斜体</em></strong>"
  );
});

test("renderInlineMarkdown converts MediaWiki bold/italic syntax", () => {
  const escaped = escapeHtml("'''wiki太字'''と''wiki斜体''");
  const rendered = renderInlineMarkdown(escaped);
  assert.match(rendered, /<strong>wiki太字<\/strong>/);
  assert.match(rendered, /<em>wiki斜体<\/em>/);
});

test("renderInfobox renders table with heading and rows", () => {
  const rendered = renderInfobox({
    heading: "テスト国",
    rows: [
      { label: "首都", value: "テスト市", segments: [{ type: "text", value: "テスト市" }] },
      { label: "公用語", value: "テスト語" },
    ],
  });

  assert.match(rendered, /infobox__heading/);
  assert.match(rendered, /テスト国/);
  assert.match(rendered, /infobox__label/);
  assert.match(rendered, /首都/);
  assert.match(rendered, /テスト市/);
  assert.match(rendered, /テスト語/);
});

test("renderInfobox renders wikilinks in row segments", () => {
  const rendered = renderInfobox({
    heading: "国名",
    rows: [
      {
        label: "首都",
        value: "[[ランパン市]]",
        segments: [
          {
            type: "link",
            status: "resolved",
            href: "#!article/ranpan",
            label: "ランパン市",
            title: "ランパン市",
          },
        ],
      },
    ],
  });

  assert.match(rendered, /wiki-link/);
  assert.match(rendered, /ランパン市/);
  assert.match(rendered, /#!article\/ranpan/);
});

test("renderNotice renders aside with style class", () => {
  const rendered = renderNotice({
    type: "notice",
    style: "fictional",
    text: "この記事は架空世界に関するものです。",
  });

  assert.match(rendered, /notice--fictional/);
  assert.match(rendered, /架空世界/);
  assert.match(rendered, /role="note"/);
});

test("renderTemplateModels renders both infoboxes and notices", () => {
  const rendered = renderTemplateModels([
    { type: "notice", style: "fictional", text: "架空" },
    { type: "infobox", heading: "国", rows: [{ label: "首都", value: "市" }] },
  ]);

  assert.match(rendered, /notice--fictional/);
  assert.match(rendered, /infobox/);
});

test("renderTemplateModels returns empty string for empty or missing input", () => {
  assert.equal(renderTemplateModels([]), "");
  assert.equal(renderTemplateModels(null), "");
  assert.equal(renderTemplateModels(undefined), "");
});

test("renderInlineMarkdown converts [text](url) to external link", () => {
  const rendered = renderInlineMarkdown("[公式サイト](https://example.com)");
  assert.match(rendered, /external-link/);
  assert.match(rendered, /https:\/\/example\.com/);
  assert.match(rendered, /公式サイト/);
  assert.match(rendered, /rel="noopener noreferrer"/);
});

test("renderInlineMarkdown converts <url> to external link", () => {
  const escaped = escapeHtml("<https://example.com>");
  const rendered = renderInlineMarkdown(escaped);
  assert.match(rendered, /external-link/);
  assert.match(rendered, /https:\/\/example\.com/);
});

test("renderInlineMarkdown restores safe HTML tags (small, sup, sub)", () => {
  const escaped = escapeHtml("<small>注記</small> と <sup>上付き</sup>");
  const rendered = renderInlineMarkdown(escaped);
  assert.match(rendered, /<small>注記<\/small>/);
  assert.match(rendered, /<sup>上付き<\/sup>/);
});

test("renderArticlePage renders list items as ul/li", () => {
  const rendered = renderArticlePage({
    id: "entry-1",
    title: "テスト",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [
          { type: "list-item", markers: "*", bodySegments: [{ type: "text", value: "項目A" }] },
          { type: "list-item", markers: "*", bodySegments: [{ type: "text", value: "項目B" }] },
          [{ type: "text", value: "通常段落" }],
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /<ul class="plain-list">/);
  assert.match(rendered, /<li>項目A<\/li>/);
  assert.match(rendered, /<li>項目B<\/li>/);
  assert.match(rendered, /<p>通常段落<\/p>/);
});

test("renderArticlePage renders embed segments as img tags", () => {
  const rendered = renderArticlePage({
    id: "entry-1",
    title: "テスト",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [
          [{ type: "embed", src: "map.png", alt: "地図" }],
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /embed-image/);
  assert.match(rendered, /content\/map\.png/);
  assert.match(rendered, /alt="地図"/);
});

test("renderArticlePage renders callout paragraphs", () => {
  const rendered = renderArticlePage({
    id: "entry-1",
    title: "テスト",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [
          {
            type: "callout",
            calloutType: "warning",
            title: "注意",
            bodySegments: [{ type: "text", value: "これは警告です。" }],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /callout--warning/);
  assert.match(rendered, /注意/);
  assert.match(rendered, /警告です/);
});

test("renderArticlePage includes notice and infobox from templateModels", () => {
  const rendered = renderArticlePage({
    id: "entry-1",
    title: "テスト国",
    category: "国家",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: ["国家"],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [],
    templateModels: [
      { type: "notice", style: "fictional", text: "架空世界です。" },
      {
        type: "infobox",
        heading: "テスト国",
        rows: [{ label: "首都", value: "テスト市", segments: [{ type: "text", value: "テスト市" }] }],
      },
    ],
  });

  assert.match(rendered, /notice--fictional/);
  assert.match(rendered, /架空世界です。/);
  assert.match(rendered, /infobox__heading/);
  assert.match(rendered, /テスト国/);
});

test("renderInlineMarkdown preserves <br> tags", () => {
  const result = renderInlineMarkdown("行1&lt;br&gt;行2&lt;br/&gt;行3");
  assert.match(result, /<br>/);
  assert.doesNotMatch(result, /&lt;br/);
});

test("renderArticlePage renders plain quote line breaks and emphasis", () => {
  const rendered = renderArticlePage({
    id: "q1",
    title: "引用",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "引用",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [{ type: "blockquote", body: "*.we caow.*<br>「私は走る。」" }],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /<blockquote class="wiki-blockquote"><em>\.we caow\.<\/em><br>「私は走る。」<\/blockquote>/);
});

test("renderArticlePage renders table cell alignment", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "表",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "表",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          {
            type: "table",
            caption: "",
            rows: [
              [
                { isHeader: true, text: "語", align: "center" },
                { isHeader: true, text: "意味" },
              ],
            ],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /<th style="text-align: center">語<\/th><th>意味<\/th>/);
});

test("renderArticlePage renders wikitable from table paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          {
            type: "table",
            caption: "テストキャプション",
            rows: [
              [
                { isHeader: true, text: "名前" },
                { isHeader: true, text: "値" },
              ],
              [
                { isHeader: false, text: "A" },
                { isHeader: false, text: "1" },
              ],
            ],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /wikitable/);
  assert.match(rendered, /テストキャプション/);
  assert.match(rendered, /<th>名前<\/th>/);
  assert.match(rendered, /<td>A<\/td>/);
});

test("renderArticlePage renders blockquote paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          { type: "blockquote", body: "引用テキスト" },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /wiki-blockquote/);
  assert.match(rendered, /引用テキスト/);
});

test("renderArticlePage renders main-article link paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "歴史",
        anchorId: "section-歴史",
        paragraphs: [
          {
            type: "main-article",
            articleName: "テストの歴史",
            segments: [
              { type: "link", status: "missing", href: "#!missing/テストの歴史", label: "テストの歴史", title: "テストの歴史" },
            ],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /main-article-link/);
  assert.match(rendered, /詳細は/);
  assert.match(rendered, /テストの歴史/);
});

test("renderFootnotes renders numbered footnote list", () => {
  const result = renderFootnotes(["注釈1です", "注釈2です"]);

  assert.match(result, /footnotes/);
  assert.match(result, /fn-1/);
  assert.match(result, /fn-2/);
  assert.match(result, /注釈1です/);
  assert.match(result, /注釈2です/);
  assert.match(result, /\[1\]/);
  assert.match(result, /\[2\]/);
});

test("renderFootnotes returns empty for no footnotes", () => {
  assert.equal(renderFootnotes([]), "");
  assert.equal(renderFootnotes(null), "");
});

test("renderArticlePage renders footnotes section", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: ["脚注のテスト"],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [[{ type: "text", value: "本文[1]" }]],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /脚注のテスト/);
  assert.match(rendered, /footnotes/);
});

test("renderArticlePage renders MediaWiki bold across link segments", () => {
  const rendered = renderArticlePage({
    id: "test",
    title: "テスト",
    category: "記事",
    created: "2026-01-01",
    updated: "2026-01-01",
    summary: "テスト",
    aliases: [],
    tags: [],
    footnotes: [],
    backlinks: [],
    unresolvedLinkCount: 0,
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          [
            { type: "text", value: "・「'''" },
            { type: "link", status: "resolved", href: "#!article/a", label: "太字リンク", title: "太字リンク" },
            { type: "text", value: "'''」" },
          ],
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /<strong>/);
  assert.match(rendered, /太字リンク/);
});

test("renderArticlePage renders definition list paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          {
            type: "definition-list",
            items: [
              {
                termSegments: [{ type: "text", value: "用語A" }],
                descriptionSegments: [{ type: "text", value: "説明A" }],
              },
            ],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /wiki-dl/);
  assert.match(rendered, /<dt>/);
  assert.match(rendered, /<dd>/);
  assert.match(rendered, /用語A/);
  assert.match(rendered, /説明A/);
});

test("renderArticlePage renders horizontal rule paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          [{ type: "text", value: "前のテキスト" }],
          { type: "hr" },
          [{ type: "text", value: "後のテキスト" }],
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /<hr/);
});

test("renderArticlePage renders poem paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          {
            type: "poem",
            body: "春の風\n花が咲く",
            bodySegments: [{ type: "text", value: "春の風\n花が咲く" }],
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /poem/);
  assert.match(rendered, /春の風/);
});

test("renderArticlePage renders code-block paragraphs", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [
          {
            type: "code-block",
            language: "javascript",
            body: "const x = 1;",
          },
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(rendered, /code-block/);
  assert.match(rendered, /const x = 1/);
});

test("renderArticlePage includes table of contents when 2+ non-overview sections", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      { heading: "概要", anchorId: "section-概要", paragraphs: [[{ type: "text", value: "本文" }]] },
      { heading: "歴史", anchorId: "section-歴史", paragraphs: [[{ type: "text", value: "歴史" }]] },
      { heading: "地理", anchorId: "section-地理", paragraphs: [[{ type: "text", value: "地理" }]] },
    ],
    templateModels: [],
  });

  assert.match(rendered, /class="toc"/);
  assert.match(rendered, /目次/);
  assert.match(rendered, /歴史/);
  assert.match(rendered, /地理/);
});

test("renderArticlePage omits table of contents when only 1 non-overview section", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      { heading: "概要", anchorId: "section-概要", paragraphs: [[{ type: "text", value: "本文" }]] },
      { heading: "歴史", anchorId: "section-歴史", paragraphs: [[{ type: "text", value: "歴史" }]] },
    ],
    templateModels: [],
  });

  assert.ok(!rendered.includes('class="toc"'));
});

test("renderCategoryCards generates links to category pages", () => {
  const rendered = renderCategoryCards([
    { name: "国家", description: "説明", articleCount: 3 },
  ]);

  assert.match(rendered, /href="#!category\//);
  assert.match(rendered, /国家/);
});

test("renderCategoryPage lists articles matching category or tag", () => {
  const articles = [
    { id: "a", title: "記事A", category: "国家", tags: [], summary: "概要A" },
    { id: "b", title: "記事B", category: "人物", tags: ["国家"], summary: "概要B" },
    { id: "c", title: "記事C", category: "組織", tags: [], summary: "概要C" },
  ];

  const rendered = renderCategoryPage("国家", articles);
  assert.match(rendered, /記事A/);
  assert.match(rendered, /記事B/);
  assert.ok(!rendered.includes("記事C"));
  assert.match(rendered, /2 件/);
});

test("renderCategoryPage shows empty message when no articles match", () => {
  const rendered = renderCategoryPage("未知", []);
  assert.match(rendered, /該当する記事はまだありません/);
});

test("renderArticlePage renders page history in sidebar", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    history: [
      { date: "2026-03-23", message: "内容を更新" },
      { date: "2026-03-20", message: "初版作成" },
    ],
    sections: [
      { heading: "概要", anchorId: "section-概要", paragraphs: [[{ type: "text", value: "本文" }]] },
    ],
    templateModels: [],
  });

  assert.match(rendered, /更新履歴/);
  assert.match(rendered, /history-list/);
  assert.match(rendered, /内容を更新/);
  assert.match(rendered, /初版作成/);
  assert.doesNotMatch(rendered, /history-author/);
});

test("renderArticlePage shows empty history message when no history", () => {
  const rendered = renderArticlePage({
    id: "t1",
    title: "テスト",
    category: "記事",
    created: "2026-03-20",
    updated: "2026-03-23",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [],
    sections: [
      { heading: "概要", anchorId: "section-概要", paragraphs: [[{ type: "text", value: "本文" }]] },
    ],
    templateModels: [],
  });

  assert.match(rendered, /履歴情報はありません/);
});

test("renderInlineMarkdown leaves underscores in generated link attributes untouched", () => {
  const html = '<a class="wiki-link wiki-link--missing" href="#!missing/foo_bar_baz">foo_bar_baz</a>';
  assert.equal(renderInlineMarkdown(html), html);
});

test("renderInlineMarkdown keeps underscores and asterisks inside external URLs", () => {
  const rendered = renderInlineMarkdown("[資料](https://example.com/a_b_c/*x*y)");
  assert.match(rendered, /href="https:\/\/example\.com\/a_b_c\/\*x\*y"/);
  assert.doesNotMatch(rendered, /<em>/);
});

test("renderInlineMarkdown does not apply emphasis inside inline code", () => {
  assert.equal(
    renderInlineMarkdown("`snake_case_name` と `*ptr*`"),
    '<code class="inline-code">snake_case_name</code> と <code class="inline-code">*ptr*</code>'
  );
});

test("renderInlineMarkdown treats intraword underscores as literal but keeps _emphasis_", () => {
  assert.equal(renderInlineMarkdown("foo_bar_baz"), "foo_bar_baz");
  assert.equal(renderInlineMarkdown("前 _斜体_ 後"), "前 <em>斜体</em> 後");
  assert.equal(renderInlineMarkdown("前 __太字__ 後"), "前 <strong>太字</strong> 後");
});

test("renderInlineMarkdown still formats emphasis inside external link labels", () => {
  const rendered = renderInlineMarkdown("[**公式**サイト](https://example.com)");
  assert.equal(
    rendered,
    '<a href="https://example.com" class="external-link" rel="noopener noreferrer"><strong>公式</strong>サイト</a>'
  );
});

const EXTERNAL_LINK_OPEN = (url) => `<a href="${url}" class="external-link" rel="noopener noreferrer">`;

test("renderInlineMarkdown converts MediaWiki [url label] to external link", () => {
  assert.equal(
    renderInlineMarkdown(escapeHtml("旧サイト[https://example.com/home 前文]を参照")),
    `旧サイト${EXTERNAL_LINK_OPEN("https://example.com/home")}前文</a>を参照`
  );
});

test("renderInlineMarkdown converts bare MediaWiki [url] to external link showing the url", () => {
  const url = "https://docs.example.com/spreadsheets/d/1CfqcFD_wQIC/edit?gid=1&x=2#gid=1";
  const escapedUrl = escapeHtml(url);
  assert.equal(
    renderInlineMarkdown(escapeHtml(`詳細情報：[${url}](The WorldSmith)`)),
    `詳細情報：${EXTERNAL_LINK_OPEN(escapedUrl)}${escapedUrl}</a>(The WorldSmith)`
  );
});

test("renderInlineMarkdown keeps emphasis markers inside MediaWiki external URLs literal", () => {
  const rendered = renderInlineMarkdown(escapeHtml("[https://example.com/a_b_c/*x*y ''資料'']"));
  assert.equal(rendered, `${EXTERNAL_LINK_OPEN("https://example.com/a_b_c/*x*y")}<em>資料</em></a>`);
  assert.equal(
    renderInlineMarkdown(escapeHtml("[https://example.com/a_b_c_]")),
    `${EXTERNAL_LINK_OPEN("https://example.com/a_b_c_")}https://example.com/a_b_c_</a>`
  );
});

test("renderInlineMarkdown only accepts http(s) for MediaWiki external links", () => {
  for (const source of ["[javascript:alert(1) x]", "[ftp://example.com x]", "[data:text/html,x]", "[//example.com x]"]) {
    const rendered = renderInlineMarkdown(escapeHtml(source));
    assert.doesNotMatch(rendered, /<a /, source);
  }
});

test("renderInlineMarkdown keeps quotes in MediaWiki external URLs from breaking the href", () => {
  const rendered = renderInlineMarkdown(escapeHtml('[https://example.com/"onmouseover="alert(1) x]'));
  assert.doesNotMatch(rendered, /"onmouseover/);
  assert.doesNotMatch(rendered, /href="[^"]*"[^ >]/);
  const raw = renderInlineMarkdown("[https://example.com/it's ok]");
  assert.equal(raw, `${EXTERNAL_LINK_OPEN("https://example.com/it&#39;s")}ok</a>`);
});

test("renderInlineMarkdown does not treat placeholder delimiters or tags as part of MediaWiki external URLs", () => {
  const tagged = '[https://example.com/<img src="x_y.png">]';
  assert.equal(renderInlineMarkdown(tagged), tagged);
  assert.equal(
    renderInlineMarkdown("[https://example.com `a_b`] \uE020[https://example.com/a\uE021]"),
    `${EXTERNAL_LINK_OPEN("https://example.com")}<code class="inline-code">a_b</code></a> ${EXTERNAL_LINK_OPEN("https://example.com/a")}https://example.com/a</a>`
  );
});

test("renderInlineMarkdown leaves non-URL square brackets alone", () => {
  assert.equal(renderInlineMarkdown(escapeHtml("[注] と [https://] と [ https://example.com ]")), "[注] と [https://] と [ https://example.com ]");
});

test("renderInlineMarkdown は '''''太字斜体''''' を正しく入れ子にする", () => {
  assert.equal(
    renderInlineMarkdown(escapeHtml("前 '''''太字斜体''''' 後")),
    "前 <strong><em>太字斜体</em></strong> 後"
  );
  // 5 連の処理が ''' と '' の単独の処理を壊さない
  assert.equal(
    renderInlineMarkdown(escapeHtml("'''太字'''と''斜体''と'''''両方'''''")),
    "<strong>太字</strong>と<em>斜体</em>と<strong><em>両方</em></strong>"
  );
});

test("renderInlineMarkdown は脚注番号の印を脚注へ飛ぶ上付きのリンクにし、原稿の [1] は文字のままにする", () => {
  assert.equal(
    renderInlineMarkdown(escapeHtml("2015年1に始まり12。原稿の [1] は残す。")),
    '2015年<sup class="footnote-ref" id="fnref-1"><a href="#fn-1">[1]</a></sup>に始まり' +
      '<sup class="footnote-ref" id="fnref-12"><a href="#fn-12">[12]</a></sup>。原稿の [1] は残す。'
  );
});

test("renderArticlePage は本文の脚注番号から脚注の一覧 (id が fn-N の項目) へリンクする", () => {
  const rendered = renderArticlePage({
    id: "lang",
    title: "テスト語",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    footnotes: [{ text: "出典A", segments: [{ type: "text", value: "出典A" }] }],
    sections: [
      {
        heading: "概要",
        anchorId: "section-概要",
        paragraphs: [[{ type: "text", value: "2015年1に始まった。" }]],
      },
    ],
    templateModels: [],
    history: [],
  });

  assert.match(rendered, /<p>2015年<sup class="footnote-ref" id="fnref-1"><a href="#fn-1">\[1\]<\/a><\/sup>に始まった。<\/p>/);
  assert.match(rendered, /<li id="fn-1"><span class="footnote__number">\[1\]<\/span> 出典A<\/li>/);
});

test("renderArticlePage renders ordered and nested mixed lists", () => {
  const item = (markers, value) => ({
    type: "list-item",
    markers,
    bodySegments: [{ type: "text", value }],
  });
  const rendered = renderArticlePage({
    id: "t-list",
    title: "テスト",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [
          item("#", "手順一"),
          item("#*", "補足"),
          item("#", "手順二"),
          item("*", "別の箇条書き"),
        ],
      },
    ],
    templateModels: [],
  });

  assert.match(
    rendered,
    /<ol class="plain-list"><li>手順一<ul class="plain-list"><li>補足<\/li><\/ul><\/li><li>手順二<\/li><\/ol><ul class="plain-list"><li>別の箇条書き<\/li><\/ul>/
  );
});

test("renderInlineMarkdown terminates on stray placeholder delimiter characters in text", () => {
  assert.equal(renderInlineMarkdown("前後0"), "前後0");
});

test("renderArticlePage wraps skipped list levels in an item instead of nesting lists directly", () => {
  const item = (markers, value) => ({
    type: "list-item",
    markers,
    bodySegments: [{ type: "text", value }],
  });
  const rendered = renderArticlePage({
    id: "t-skip",
    title: "テスト",
    category: "記事",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "テスト",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      {
        heading: "概要",
        anchorId: "section-overview",
        paragraphs: [item("**", "子"), item("*", "親"), item("***", "孫"), item("*", "次")],
      },
    ],
    templateModels: [],
  });

  const list = rendered.match(/<ul class="plain-list">.*<\/ul>/s)[0].replaceAll(' class="plain-list"', "");
  assert.equal(
    list,
    "<ul><li><ul><li>子</li></ul></li><li>親<ul><li><ul><li>孫</li></ul></li></ul></li><li>次</li></ul>"
  );
});

test("renderArticlePage は見出しの深さで目次を入れ子にし、### 以下を小見出しにする", () => {
  const section = (heading, level) => ({ heading, level, anchorId: `section-${heading}`, paragraphs: [] });
  const rendered = renderArticlePage({
    id: "religion",
    title: "デーレ教",
    category: "宗教",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "",
    aliases: [],
    tags: [],
    unresolvedLinkCount: 0,
    backlinks: [],
    sections: [
      section("概要", 2),
      section("歴史", 2),
      section("起源", 3),
      section("細部", 4),
      section("教義", 2),
    ],
    templateModels: [],
    footnotes: [],
    history: [],
  });

  const toc = rendered.match(/<ol class="toc__list">(.*?)<\/ol>\s*<\/nav>/s)[1];
  assert.equal(
    toc,
    '<li><a href="#section-歴史">歴史</a><ol><li><a href="#section-起源">起源</a><ol><li><a href="#section-細部">細部</a></li></ol></li></ol></li><li><a href="#section-教義">教義</a></li>'
  );
  assert.match(rendered, /<h3 class="article-section__heading">歴史<\/h3>/);
  assert.match(rendered, /article-section--sub" id="section-起源">\s*<h4 class="article-section__heading">起源<\/h4>/);
  assert.match(rendered, /<h5 class="article-section__heading">細部<\/h5>/);
});

test("renderMaintenanceReportPage は保守レポートを記事と同じ見た目のページにし、記事や未作成の名前へリンクする", () => {
  const rendered = renderMaintenanceReportPage({
    generatedAt: "2026-11-05T00:00:00.000Z",
    summary: {
      articleCount: 2,
      linkCount: 3,
      articleLinkCount: 1,
      averageOutgoingArticles: 0.5,
      averageIncoming: 0.5,
      missingPageCount: 1,
      missingReferenceCount: 2,
      ambiguousNameCount: 0,
      orphanCount: 1,
      deadEndCount: 1,
    },
    orphans: [{ id: "lonely", title: "孤島", outgoingArticleCount: 0 }],
    deadEnds: [{ id: "lonely", title: "孤島", missingTitles: ["未作成港"] }],
    missingPages: [{ title: "未作成港", referenceCount: 2, sourceEntries: [{ id: "lonely", title: "孤島" }] }],
    ambiguousNames: [],
    linkDensity: [
      {
        id: "lonely",
        title: "孤島",
        outgoingArticleCount: 0,
        incomingCount: 0,
        missingCount: 1,
        ambiguousCount: 0,
        linkCount: 1,
        textLength: 10,
        linksPer1000Chars: 100,
      },
    ],
  });

  assert.match(rendered, /<h2>保守レポート<\/h2>/);
  // UTC 0 時は日本時間の 9 時
  assert.match(rendered, /生成: 2026\.11\.05 09:00/);
  assert.match(rendered, /<a href="#!article\/lonely">孤島<\/a>/);
  assert.match(rendered, /wiki-link--missing" href="#!missing\/%E6%9C%AA%E4%BD%9C%E6%88%90%E6%B8%AF">未作成港<\/a>/);
  assert.match(renderMaintenanceReportPage(null), /読み込めませんでした/);
  assert.match(renderMaintenanceReportPage(null, { loading: true }), /読み込み中/);
});
