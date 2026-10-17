import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArticleRecord,
  extractLeadingTemplates,
  findDuplicateEntryIds,
  getUnpublishedReason,
  parseFrontmatter,
  parseMarkdownSections,
} from "../src/lib/content-import.js";

test("parseFrontmatter reads scalar, list and boolean values", () => {
  const source = `---
title: デーレ共和国
aliases:
  - デーレ
  - 共和国デーレ
tags:
  - 国家
draft: false
summary: 概要文
---
本文です。`;

  const parsed = parseFrontmatter(source);

  assert.deepEqual(parsed.data, {
    title: "デーレ共和国",
    aliases: ["デーレ", "共和国デーレ"],
    tags: ["国家"],
    draft: false,
    summary: "概要文",
  });
  assert.equal(parsed.body, "本文です。");
});

test("extractLeadingTemplates collects one-line and multiline templates", () => {
  const source = `{{架空|デーレ界}}
{{基礎情報 国
|公用語=[[デーレ語]]
|首都=[[ランパン記念市]]
}}

本文です。`;

  const parsed = extractLeadingTemplates(source);

  assert.deepEqual(
    parsed.templates.map((template) => template.name),
    ["架空", "基礎情報 国"]
  );
  assert.deepEqual(parsed.templates[0].positional, ["デーレ界"]);
  assert.equal(parsed.templates[1].params["公用語"], "[[デーレ語]]");
  assert.equal(parsed.body, "本文です。");
});

test("parseMarkdownSections keeps headings, strips inline templates and flattens lists", () => {
  const sections = parseMarkdownSections(`**白磁海**は[[潮見港]]へ通じる。

## 地理
### [[灯台列島]]
海図改訂は{{要出典|考察}}[[灰塔文庫]]にも残る。
- [[潮見港]]
- [[白磁航路台帳]]
`);

  assert.deepEqual(
    sections.map((section) => section.heading),
    ["概要", "地理", "灯台列島"]
  );
  assert.equal(
    sections[2].paragraphs[0],
    "海図改訂は[[灰塔文庫]]にも残る。"
  );
  assert.deepEqual(sections[2].paragraphs[1], { type: "list-item", markers: "*", body: "[[潮見港]]" });
  assert.deepEqual(sections[2].paragraphs[2], { type: "list-item", markers: "*", body: "[[白磁航路台帳]]" });
});

test("buildArticleRecord normalizes markdown content into article data", () => {
  const article = buildArticleRecord({
    relativePath: "samples/白磁海.md",
    fileBasename: "白磁海",
    created: "2026-03-10",
    updated: "2026-03-15",
    sourceText: `---
title: 白磁海
category: 世界設定
aliases:
  - 白海
tags:
  - 地理
summary: 白磁海の要約です
---
**白磁海**は、[[潮見港]]と[[星舟連盟]]が向き合う海域である。

## 地理
### [[灯台列島]]
海図改訂は{{要出典|考察}}[[灰塔文庫]]にも残る。
- [[潮見港]]
`,
  });

  assert.equal(article.id, "samples/白磁海");
  assert.equal(article.title, "白磁海");
  assert.equal(article.category, "世界設定");
  assert.deepEqual(article.aliases, ["白海"]);
  assert.deepEqual(article.tags, ["地理", "世界設定"]);
  assert.equal(article.summary, "白磁海の要約です");
  assert.deepEqual(article.relatedTitles, ["潮見港", "星舟連盟", "灯台列島", "灰塔文庫"]);
  assert.deepEqual(
    article.sections.map((section) => section.heading),
    ["概要", "地理", "灯台列島"]
  );
});

test("buildArticleRecord produces templateModels when templateHandlers are provided", () => {
  const templateHandlers = new Map([
    [
      "架空",
      (template) => ({
        type: "notice",
        style: "fictional",
        text: template.positional[0]
          ? `この記事は架空世界「${template.positional[0]}」に関するものです。`
          : "この記事は架空世界に関するものです。",
      }),
    ],
    [
      "基礎情報 国",
      (template) => ({
        type: "infobox",
        heading: template.params["訳国名"] || "",
        rows: [
          { label: "首都", value: template.params["首都"] ?? "" },
        ].filter((row) => row.value),
      }),
    ],
  ]);

  const article = buildArticleRecord({
    relativePath: "samples/テスト国.md",
    fileBasename: "テスト国",
    created: "2026-03-10",
    updated: "2026-03-15",
    templateHandlers,
    sourceText: `---
title: テスト国
---
{{架空|テスト界}}
{{基礎情報 国
|訳国名=テスト国
|首都=[[テスト市]]
}}

**テスト国**は架空の国である。
`,
  });

  assert.equal(article.templateModels.length, 2);
  assert.equal(article.templateModels[0].type, "notice");
  assert.equal(article.templateModels[0].style, "fictional");
  assert.match(article.templateModels[0].text, /テスト界/);
  assert.equal(article.templateModels[1].type, "infobox");
  assert.equal(article.templateModels[1].heading, "テスト国");
  assert.equal(article.templateModels[1].rows[0].label, "首都");
  assert.equal(article.templateModels[1].rows[0].value, "[[テスト市]]");
});

test("buildArticleRecord returns empty templateModels without handlers", () => {
  const article = buildArticleRecord({
    relativePath: "samples/テスト.md",
    fileBasename: "テスト",
    created: "2026-03-10",
    updated: "2026-03-15",
    sourceText: `{{架空|テスト界}}

本文。
`,
  });

  assert.deepEqual(article.templateModels, []);
});

test("parseMarkdownSections extracts callout blocks", () => {
  const sections = parseMarkdownSections(`本文。

> [!note] 注意事項
> これは注意です。
> 二行目。

続きの段落。`);

  assert.equal(sections[0].paragraphs[0], "本文。");
  assert.equal(sections[0].paragraphs[1].type, "callout");
  assert.equal(sections[0].paragraphs[1].calloutType, "note");
  assert.equal(sections[0].paragraphs[1].title, "注意事項");
  assert.match(sections[0].paragraphs[1].body, /注意です/);
  assert.equal(sections[0].paragraphs[2], "続きの段落。");
});

test("parseMarkdownSections preserves safe inline HTML in section paragraphs", () => {
  const sections = parseMarkdownSections(
    "<small>詳しくは参照</small>。<script>alert(1)</script>"
  );

  assert.match(sections[0].paragraphs[0], /<small>詳しくは参照<\/small>/);
  assert.doesNotMatch(sections[0].paragraphs[0], /<script>/);
});

test("parseMarkdownSections preserves inline formatting in section paragraphs", () => {
  const sections = parseMarkdownSections(
    "**太字**と*斜体*と`コード`を含む段落。\n\n## 節\n'''wiki太字'''と''wiki斜体''。"
  );

  assert.equal(sections[0].paragraphs[0], "**太字**と*斜体*と`コード`を含む段落。");
  assert.equal(sections[1].paragraphs[0], "'''wiki太字'''と''wiki斜体''。");
});

test("parseMarkdownSections parses MediaWiki headings (== H2 ==)", () => {
  const sections = parseMarkdownSections(
    "概要文。\n\n== 地理 ==\n地理の説明。\n\n=== 気候 ===\n気候の説明。"
  );

  assert.deepEqual(
    sections.map((s) => s.heading),
    ["概要", "地理", "気候"]
  );
  assert.equal(sections[1].paragraphs[0], "地理の説明。");
  assert.equal(sections[2].paragraphs[0], "気候の説明。");
});

test("parseMarkdownSections parses MediaWiki tables ({| ... |})", () => {
  const sections = parseMarkdownSections(`本文。

{| class="wikitable"
|+ キャプション
! 名前
! 値
|-
| A
| 1
|-
| B
| 2
|}

続き。`);

  assert.equal(sections[0].paragraphs[0], "本文。");
  assert.equal(sections[0].paragraphs[1].type, "table");
  assert.equal(sections[0].paragraphs[1].caption, "キャプション");
  assert.equal(sections[0].paragraphs[1].rows.length, 3);
  assert.equal(sections[0].paragraphs[1].rows[0][0].isHeader, true);
  assert.equal(sections[0].paragraphs[1].rows[0][0].text, "名前");
  assert.equal(sections[0].paragraphs[1].rows[1][0].text, "A");
  assert.equal(sections[0].paragraphs[2], "続き。");
});

test("parseMarkdownSections parses MediaWiki table with rowspan", () => {
  const sections = parseMarkdownSections(`{| class="wikitable"
! Col1
! Col2
|-
| rowspan="2" | span
| A
|-
| B
|}`);

  const row = sections[0].paragraphs[0].rows[1];
  assert.equal(row[0].rowspan, 2);
  assert.equal(row[0].text, "span");
});

test("parseMarkdownSections parses blockquote elements", () => {
  const sections = parseMarkdownSections(
    "前文。\n\n<blockquote>引用文です。</blockquote>\n\n後文。"
  );

  assert.equal(sections[0].paragraphs[0], "前文。");
  assert.equal(sections[0].paragraphs[1].type, "blockquote");
  assert.equal(sections[0].paragraphs[1].body, "引用文です。");
  assert.equal(sections[0].paragraphs[2], "後文。");
});

test("parseMarkdownSections parses inline blockquotes mid-line", () => {
  const sections = parseMarkdownSections(
    "<blockquote>引用A</blockquote>中間テキスト。<blockquote>引用B</blockquote>"
  );

  assert.equal(sections[0].paragraphs[0].type, "blockquote");
  assert.equal(sections[0].paragraphs[0].body, "引用A");
  assert.equal(sections[0].paragraphs[1], "中間テキスト。");
  assert.equal(sections[0].paragraphs[2].type, "blockquote");
  assert.equal(sections[0].paragraphs[2].body, "引用B");
});

test("parseMarkdownSections parses MediaWiki list items (* item)", () => {
  const sections = parseMarkdownSections("* 項目A\n* [[項目B]]");

  assert.deepEqual(sections[0].paragraphs[0], { type: "list-item", markers: "*", body: "項目A" });
  assert.deepEqual(sections[0].paragraphs[1], { type: "list-item", markers: "*", body: "[[項目B]]" });
});

test("buildArticleRecord extracts footnotes from <ref> tags", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文に脚注がある<ref>注釈1</ref>。次<ref>注釈2</ref>。\n\n<references />`,
  });

  assert.equal(article.footnotes.length, 2);
  assert.equal(article.footnotes[0], "注釈1");
  assert.equal(article.footnotes[1], "注釈2");
  assert.match(article.sections[0].paragraphs[0], /\[1\]/);
  assert.match(article.sections[0].paragraphs[0], /\[2\]/);
});

test("buildArticleRecord extracts [[Category:...]] as tags", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n[[Category:テスト国]][[Category:架空の地域]]`,
  });

  assert.ok(article.tags.includes("テスト国"));
  assert.ok(article.tags.includes("架空の地域"));
});

test("buildArticleRecord converts [[ファイル:...]] to embed syntax", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `[[ファイル:map.png|サムネイル|説明]]\n\n本文。`,
  });

  assert.match(article.sections[0].paragraphs[0], /!\[\[map\.png\]\]/);
});

test("buildArticleRecord uses the file name as title and the leading bold name as an alias", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `'''テスト国'''は架空の国である。`,
  });

  assert.equal(article.title, "テスト");
  assert.deepEqual(article.aliases, ["テスト国"]);
});

test("buildArticleRecord strips file extension from id for .wiki files", () => {
  const article = buildArticleRecord({
    relativePath: "article.wiki",
    fileBasename: "article",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。`,
  });

  assert.equal(article.id, "article");
});

test("parseMarkdownSections handles {{main|...}} as main-article link", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n== 歴史 ==\n{{main|テストの歴史}}テストの歴史は長い。`,
  });

  const historySec = article.sections.find((s) => s.heading === "歴史");
  assert.ok(historySec);
  assert.equal(historySec.paragraphs[0].type, "main-article");
  assert.equal(historySec.paragraphs[0].articleName, "テストの歴史");
  assert.match(historySec.paragraphs[1], /歴史は長い/);
});

test("extractLeadingTemplates finds templates after intro paragraph", () => {
  const source = `'''テスト国'''は架空の国である。

{{基礎情報 国
|首都=[[テスト市]]
}}

本文です。`;

  const parsed = extractLeadingTemplates(source);

  assert.equal(parsed.templates.length, 1);
  assert.equal(parsed.templates[0].name, "基礎情報 国");
  assert.equal(parsed.templates[0].params["首都"], "[[テスト市]]");
  assert.match(parsed.body, /テスト国/);
  assert.match(parsed.body, /本文です/);
  assert.ok(!parsed.body.includes("基礎情報 国"));
});

test("buildArticleRecord extracts relatedTitles from table cells", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n{| class="wikitable"\n! 名前\n|-\n| [[テーブルリンク先]]\n|}`,
  });

  assert.ok(article.relatedTitles.includes("テーブルリンク先"));
});

test("buildArticleRecord extracts relatedTitles from blockquote body", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n<blockquote>[[引用リンク先]]の言葉。</blockquote>`,
  });

  assert.ok(article.relatedTitles.includes("引用リンク先"));
});

test("parseMarkdownSections parses definition lists (; and :)", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n; 用語A\n: 説明A\n; 用語B\n: 説明B`,
  });

  const section = article.sections[0];
  const dls = section.paragraphs.filter((p) => p.type === "definition-list");
  assert.ok(dls.length >= 1, "definition-list paragraphs should exist");
  assert.equal(dls[0].items[0].term, "用語A");
  assert.equal(dls[0].items[0].description, "説明A");
  const lastDl = dls[dls.length - 1];
  assert.equal(lastDl.items[lastDl.items.length - 1].term, "用語B");
});

test("parseMarkdownSections parses horizontal rule (----)", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `前の段落。\n\n----\n\n後の段落。`,
  });

  const section = article.sections[0];
  const hr = section.paragraphs.find((p) => p.type === "hr");
  assert.ok(hr, "hr paragraph should exist");
});

test("buildArticleRecord handles <nowiki> to suppress wiki parsing", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。<nowiki>[[リンクではない]]</nowiki>と通常テキスト。`,
  });

  const section = article.sections[0];
  const texts = section.paragraphs.join(" ");
  assert.ok(!texts.includes("[[リンクではない]]"), "nowiki content should not contain raw wikilink brackets");
  assert.ok(!article.relatedTitles.includes("リンクではない"), "nowiki content should not be parsed as link");
});

test("buildArticleRecord handles #REDIRECT", () => {
  const article = buildArticleRecord({
    relativePath: "旧名.wiki",
    fileBasename: "旧名",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `#REDIRECT [[新名]]`,
  });

  assert.equal(article.isRedirect, true);
  assert.equal(article.redirectTarget, "新名");
});

test("buildArticleRecord strips magic words", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `__TOC__\n本文テキスト。\n__NOTOC__`,
  });

  const allText = article.sections.flatMap((s) => s.paragraphs).join(" ");
  assert.ok(!allText.includes("__TOC__"), "magic words should be stripped");
  assert.ok(!allText.includes("__NOTOC__"), "magic words should be stripped");
  assert.ok(allText.includes("本文テキスト"), "normal text should remain");
});

test("parseMarkdownSections parses nested lists (** and ##)", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n* 項目A\n** サブ項目A1\n** サブ項目A2\n* 項目B`,
  });

  const listItems = article.sections[0].paragraphs.filter((p) => p.type === "list-item");
  assert.deepEqual(
    listItems.map(({ markers, body }) => [markers, body]),
    [
      ["*", "項目A"],
      ["**", "サブ項目A1"],
      ["**", "サブ項目A2"],
      ["*", "項目B"],
    ]
  );
});

test("parseMarkdownSections parses <poem> blocks", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n<poem>\n春の風\n花が咲く\n</poem>`,
  });

  const section = article.sections[0];
  const poem = section.paragraphs.find((p) => p.type === "poem");
  assert.ok(poem, "poem paragraph should exist");
  assert.ok(poem.body.includes("春の風"), "poem body should contain content");
});

test("parseMarkdownSections parses <syntaxhighlight> blocks", () => {
  const article = buildArticleRecord({
    relativePath: "test.wiki",
    fileBasename: "テスト",
    created: "2026-03-20",
    updated: "2026-03-23",
    sourceText: `本文。\n\n<syntaxhighlight lang="javascript">\nconst x = 1;\n</syntaxhighlight>`,
  });

  const section = article.sections[0];
  const code = section.paragraphs.find((p) => p.type === "code-block");
  assert.ok(code, "code-block paragraph should exist");
  assert.equal(code.language, "javascript");
  assert.ok(code.body.includes("const x = 1"), "code body should contain content");
});

test("findDuplicateEntryIds reports files whose ids collide after dropping the extension", () => {
  const build = (relativePath) =>
    buildArticleRecord({
      relativePath,
      fileBasename: "article",
      sourceText: "本文",
      created: "2026-01-01",
      updated: "2026-01-01",
    });

  const entries = [build("article.md"), build("article.wiki"), build("other/article.md")];

  assert.deepEqual(findDuplicateEntryIds(entries), [
    { id: "article", sourcePaths: ["article.md", "article.wiki"] },
  ]);
});

test("buildArticleRecord summary keeps intraword underscores and drops link syntax", () => {
  const record = buildArticleRecord({
    relativePath: "summary.md",
    fileBasename: "summary",
    sourceText: "snake_case_name と [資料](https://example.com/a_b) と _強調_",
    created: "2026-01-01",
    updated: "2026-01-01",
  });

  assert.equal(record.summary, "snake_case_name と 資料 と 強調");
});

test("parseFrontmatter reads Japanese keys", () => {
  const { data } = parseFrontmatter("---\n種別: 国\n公開: false\n---\n本文");
  assert.equal(data["種別"], "国");
  assert.equal(data["公開"], false);
});

test("getUnpublishedReason detects unreviewed stubs, meta notes and opt-out notes", () => {
  assert.equal(getUnpublishedReason("---\n種別: 国\n---\n> [!caution] 未査読\n> 下書き\n\n本文"), "未査読");
  assert.equal(getUnpublishedReason("---\r\n種別: 地形\r\n---\r\n> [!caution] 未査読\r\n本文"), "未査読");
  assert.equal(getUnpublishedReason("---\n種別: メタ\n---\n# 規約"), "種別: メタ");
  assert.equal(getUnpublishedReason("---\n公開: false\n---\n書きかけ"), "公開: false");
  assert.equal(getUnpublishedReason("---\n種別: 国\n---\n本文で未査読という語に触れるだけ"), null);
  assert.equal(getUnpublishedReason("frontmatter なしの本文"), null);
});

test("getUnpublishedReason is not fooled by a BOM, trailing YAML comments or callout variants", () => {
  assert.equal(getUnpublishedReason("\uFEFF---\n公開: false\n---\n書きかけ"), "公開: false");
  assert.equal(getUnpublishedReason("\uFEFF> [!caution] 未査読\n本文"), "未査読");
  assert.equal(getUnpublishedReason("---\n公開: false # 書きかけ\n---\n本文"), "公開: false");
  assert.equal(getUnpublishedReason("---\n種別: メタ # 内部資料\n---\n本文"), "種別: メタ");
  assert.equal(getUnpublishedReason("> [!CAUTION]- 未査読\n本文"), "未査読");
  assert.equal(getUnpublishedReason('---\ntitle: "C# 入門"\n---\n本文'), null);
});

test("getUnpublishedReason handles quoted values with trailing comments and draft notes", () => {
  assert.equal(getUnpublishedReason('---\n種別: "メタ" # 内部資料\n---\n本文'), "種別: メタ");
  assert.equal(getUnpublishedReason('---\n公開: "false" # 書きかけ\n---\n本文'), "公開: false");
  assert.equal(getUnpublishedReason("---\ndraft: true\n---\n本文"), "draft: true");
  assert.equal(getUnpublishedReason("---\n公開: true\n---\n本文"), null);
});

test("parseFrontmatter keeps # inside quoted values", () => {
  const { data } = parseFrontmatter('---\ntitle: "C# 入門" # コメント\n---\n本文');
  assert.equal(data.title, "C# 入門");
});

test("getUnpublishedReason also catches quoted keys in the raw frontmatter", () => {
  assert.equal(getUnpublishedReason('---\n"公開": false\n---\n本文'), "公開: false");
  assert.equal(getUnpublishedReason("---\n'draft': true\n---\n本文"), "draft: true");
  assert.equal(getUnpublishedReason("---\n  種別 : 'メタ'\n---\n本文"), "種別: メタ");
  assert.equal(getUnpublishedReason("本文中に 公開: false と書いただけ"), null);
});

test("parseFrontmatter keeps escaped quotes and # inside quoted values", () => {
  const { data } = parseFrontmatter('---\ntitle: "引用符 \\" # 記号" # コメント\nsub: \'It\'\'s # ok\'\n---\n本文');
  assert.equal(data.title, '引用符 " # 記号');
  assert.equal(data.sub, "It's # ok");
});
