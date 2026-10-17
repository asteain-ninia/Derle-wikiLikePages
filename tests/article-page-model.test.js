import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArticleHref,
  buildArticlePageModel,
  buildDisambiguationPageModel,
  buildMissingPageModel,
  buildReferenceIndex,
  buildWikiGraph,
  buildWikiTextSegments,
  extractWikiLinks,
  parseAppRoute,
  resolveArticleReference,
} from "../src/lib/article-page-model.js";

const fixtureEntries = [
  {
    id: "sea",
    title: "白磁海",
    aliases: ["白海"],
    category: "世界設定",
    created: "2026-03-10",
    updated: "2026-03-15",
    summary: "海域ページ",
    sections: [
      {
        heading: "概要",
        paragraphs: ["[[潮見港]]と[[白磁航路台帳]]を参照する。"],
      },
    ],
  },
  {
    id: "port",
    title: "潮見港",
    category: "世界設定",
    created: "2026-03-11",
    updated: "2026-03-14",
    summary: "港ページ",
    sections: [
      {
        heading: "概要",
        paragraphs: ["[[白海]]と[[調査記録]]を参照する。"],
      },
    ],
  },
  {
    id: "survey-a",
    title: "調査記録A",
    aliases: ["調査記録"],
    category: "年表",
    created: "2026-03-12",
    updated: "2026-03-13",
    summary: "A",
    sections: [],
  },
  {
    id: "survey-b",
    title: "調査記録B",
    aliases: ["調査記録"],
    category: "年表",
    created: "2026-03-12",
    updated: "2026-03-16",
    summary: "B",
    sections: [],
  },
];

test("extractWikiLinks parses simple, display-text and heading links", () => {
  assert.deepEqual(extractWikiLinks("[[白磁海]] [[潮見港|港]] [[白磁海#航路]]"), [
    {
      raw: "[[白磁海]]",
      start: 0,
      end: 7,
      isEmbed: false,
      pageTitle: "白磁海",
      heading: "",
      displayText: "",
    },
    {
      raw: "[[潮見港|港]]",
      start: 8,
      end: 17,
      isEmbed: false,
      pageTitle: "潮見港",
      heading: "",
      displayText: "港",
    },
    {
      raw: "[[白磁海#航路]]",
      start: 18,
      end: 28,
      isEmbed: false,
      pageTitle: "白磁海",
      heading: "航路",
      displayText: "",
    },
  ]);
});

test("extractWikiLinks distinguishes embed links from regular links", () => {
  const links = extractWikiLinks("![[map.png]] と [[白磁海]]");
  assert.equal(links.length, 2);
  assert.equal(links[0].isEmbed, true);
  assert.equal(links[0].pageTitle, "map.png");
  assert.equal(links[0].raw, "![[map.png]]");
  assert.equal(links[1].isEmbed, false);
  assert.equal(links[1].pageTitle, "白磁海");
});

test("buildWikiTextSegments produces embed segments for ![[...]]", () => {
  const graph = buildWikiGraph(fixtureEntries);
  const segments = buildWikiTextSegments("画像: ![[map.png]] 以上", graph);

  assert.equal(segments.length, 3);
  assert.equal(segments[0].type, "text");
  assert.equal(segments[1].type, "embed");
  assert.equal(segments[1].src, "map.png");
  assert.equal(segments[2].type, "text");
});

test("buildReferenceIndex resolves titles and aliases", () => {
  const referenceIndex = buildReferenceIndex(fixtureEntries);
  const entryById = new Map(fixtureEntries.map((entry) => [entry.id, entry]));

  assert.equal(
    resolveArticleReference(referenceIndex, entryById, "白海").type,
    "article"
  );
  assert.equal(
    resolveArticleReference(referenceIndex, entryById, "調査記録").type,
    "ambiguous"
  );
  assert.equal(
    resolveArticleReference(referenceIndex, entryById, "白磁航路台帳").type,
    "missing"
  );
});

test("buildWikiGraph collects backlinks, missing pages and disambiguation pages", () => {
  const graph = buildWikiGraph(fixtureEntries);

  assert.deepEqual(
    graph.backlinksById.port.map((entry) => entry.id),
    ["sea"]
  );
  assert.deepEqual(
    graph.backlinksById.sea.map((entry) => entry.id),
    ["port"]
  );
  assert.deepEqual(
    graph.missingPagesByTitle["白磁航路台帳"].sourceEntries.map((entry) => entry.id),
    ["sea"]
  );
  assert.deepEqual(
    graph.disambiguationPagesByTitle["調査記録"].candidates.map((entry) => entry.id),
    ["survey-b", "survey-a"]
  );
});

test("buildWikiGraph also resolves links that appear in section headings", () => {
  const graph = buildWikiGraph([
    {
      id: "sea",
      title: "白磁海",
      category: "世界設定",
      created: "2026-03-10",
      updated: "2026-03-15",
      summary: "海域ページ",
      sections: [],
    },
    {
      id: "guide",
      title: "白磁海案内",
      category: "世界設定",
      created: "2026-03-11",
      updated: "2026-03-14",
      summary: "案内ページ",
      sections: [
        {
          heading: "白磁海",
          sourceHeading: "[[白磁海]]",
          paragraphs: [],
        },
      ],
    },
  ]);

  assert.deepEqual(
    graph.backlinksById.sea.map((entry) => entry.id),
    ["guide"]
  );
});

test("buildWikiTextSegments turns unresolved links into missing-page routes", () => {
  const graph = buildWikiGraph(fixtureEntries);
  const segments = buildWikiTextSegments("本文 [[白磁航路台帳]] 末尾", graph);

  assert.deepEqual(segments, [
    { type: "text", value: "本文 " },
    {
      type: "link",
      status: "missing",
      href: "#!missing/%E7%99%BD%E7%A3%81%E8%88%AA%E8%B7%AF%E5%8F%B0%E5%B8%B3",
      label: "白磁航路台帳",
      title: "白磁航路台帳",
    },
    { type: "text", value: " 末尾" },
  ]);
});

test("buildArticlePageModel includes backlinks and unresolved link counts", () => {
  const graph = buildWikiGraph(fixtureEntries);
  const pageModel = buildArticlePageModel(graph, "sea");

  assert.equal(pageModel?.backlinks.length, 1);
  assert.equal(pageModel?.backlinks[0].id, "port");
  assert.equal(pageModel?.unresolvedLinkCount, 1);
  assert.equal(pageModel?.sections[0].paragraphs[0][0].type, "link");
});

test("buildMissingPageModel returns source pages and suggestions", () => {
  const graph = buildWikiGraph(fixtureEntries);
  const missingPageModel = buildMissingPageModel(graph, "白磁航路台帳");

  assert.deepEqual(
    missingPageModel.sourceEntries.map((entry) => entry.id),
    ["sea"]
  );
  assert.ok(Array.isArray(missingPageModel.suggestions));
});

test("buildDisambiguationPageModel returns candidate entries", () => {
  const graph = buildWikiGraph(fixtureEntries);
  const pageModel = buildDisambiguationPageModel(graph, "調査記録");

  assert.deepEqual(
    pageModel?.candidates.map((entry) => entry.id),
    ["survey-b", "survey-a"]
  );
});

test("buildArticlePageModel resolves wikilinks in infobox templateModels", () => {
  const entriesWithInfobox = [
    {
      id: "country",
      title: "テスト国",
      aliases: [],
      category: "国家",
      created: "2026-03-10",
      updated: "2026-03-15",
      summary: "テスト国の概要",
      sections: [
        { heading: "概要", paragraphs: ["テスト国は架空の国である。"] },
      ],
      templateModels: [
        {
          type: "notice",
          style: "fictional",
          text: "この記事は架空世界に関するものです。",
        },
        {
          type: "infobox",
          heading: "テスト国",
          rows: [
            { label: "首都", value: "[[テスト市]]" },
            { label: "公用語", value: "テスト語" },
          ],
        },
      ],
    },
    {
      id: "city",
      title: "テスト市",
      category: "世界設定",
      created: "2026-03-11",
      updated: "2026-03-14",
      summary: "首都",
      sections: [],
    },
  ];

  const graph = buildWikiGraph(entriesWithInfobox);
  const pageModel = buildArticlePageModel(graph, "country");

  // notice should pass through unchanged
  assert.equal(pageModel.templateModels[0].type, "notice");
  assert.equal(pageModel.templateModels[0].style, "fictional");

  // infobox rows should have resolved segments
  const infobox = pageModel.templateModels[1];
  assert.equal(infobox.type, "infobox");
  assert.equal(infobox.rows[0].label, "首都");
  assert.equal(infobox.rows[0].segments.length, 1);
  assert.equal(infobox.rows[0].segments[0].type, "link");
  assert.equal(infobox.rows[0].segments[0].status, "resolved");
  assert.match(infobox.rows[0].segments[0].href, /city/);

  // plain text row should have text segment only
  assert.equal(infobox.rows[1].label, "公用語");
  assert.equal(infobox.rows[1].segments.length, 1);
  assert.equal(infobox.rows[1].segments[0].type, "text");
  assert.equal(infobox.rows[1].segments[0].value, "テスト語");
});

test("parseAppRoute understands article, missing and home routes", () => {
  assert.deepEqual(parseAppRoute(buildArticleHref("sea", "概要")), {
    view: "article",
    entryId: "sea",
    sectionHeading: "概要",
  });
  assert.deepEqual(parseAppRoute("#!missing/%E7%99%BD%E7%A3%81%E6%B5%B7"), {
    view: "missing",
    title: "白磁海",
  });
  assert.deepEqual(parseAppRoute("#overview"), { view: "home" });
  assert.deepEqual(parseAppRoute("#!category/%E5%9B%BD%E5%AE%B6"), {
    view: "category",
    category: "国家",
  });
});

test("buildWikiGraph registers backlinks from table cell wikilinks", () => {
  const entries = [
    {
      id: "source",
      title: "ソース",
      updated: "2026-01-01",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: [
            {
              type: "table",
              caption: "",
              rows: [
                [{ isHeader: true, text: "名前" }],
                [{ isHeader: false, text: "[[白磁海]]の港" }],
              ],
            },
          ],
        },
      ],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const backlinks = graph.backlinksById["sea"] ?? [];
  assert.ok(
    backlinks.some((entry) => entry.id === "source"),
    "table cell wikilink should register a backlink"
  );
});

test("buildWikiGraph registers backlinks from blockquote wikilinks", () => {
  const entries = [
    {
      id: "source",
      title: "ソース",
      updated: "2026-01-01",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: [
            {
              type: "blockquote",
              body: "[[白磁海]]は美しい。",
            },
          ],
        },
      ],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const backlinks = graph.backlinksById["sea"] ?? [];
  assert.ok(
    backlinks.some((entry) => entry.id === "source"),
    "blockquote wikilink should register a backlink"
  );
});

test("buildArticlePageModel resolves wikilinks in table cells", () => {
  const entries = [
    {
      id: "withTable",
      title: "テーブル記事",
      category: "記事",
      created: "2026-01-01",
      updated: "2026-01-01",
      summary: "",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: [
            {
              type: "table",
              caption: "",
              rows: [
                [{ isHeader: false, text: "[[白磁海]]へ" }],
              ],
            },
          ],
        },
      ],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const model = buildArticlePageModel(graph, "withTable");
  const table = model.sections[0].paragraphs[0];
  assert.equal(table.type, "table");
  assert.ok(table.rows[0][0].segments, "table cell should have segments");
  const linkSegment = table.rows[0][0].segments.find((s) => s.type === "link");
  assert.ok(linkSegment, "table cell should contain a resolved link segment");
  assert.equal(linkSegment.status, "resolved");
});

test("buildWikiGraph registers backlinks from templateModels wikilinks", () => {
  const entries = [
    {
      id: "source",
      title: "ソース",
      updated: "2026-01-01",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: ["本文"],
        },
      ],
      templateModels: [
        {
          type: "infobox",
          heading: "テスト",
          rows: [{ label: "関連", value: "[[白磁海]]の近海" }],
        },
      ],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const backlinks = graph.backlinksById["sea"] ?? [];
  assert.ok(
    backlinks.some((entry) => entry.id === "source"),
    "templateModels infobox row wikilink should register a backlink"
  );
});

test("buildWikiGraph registers backlinks from footnote wikilinks", () => {
  const entries = [
    {
      id: "source",
      title: "ソース",
      updated: "2026-01-01",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: ["本文[1]"],
        },
      ],
      footnotes: ["[[白磁海]]に関する注釈"],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const backlinks = graph.backlinksById["sea"] ?? [];
  assert.ok(
    backlinks.some((entry) => entry.id === "source"),
    "footnote wikilink should register a backlink"
  );
});

test("buildArticlePageModel resolves wikilinks in footnotes", () => {
  const entries = [
    {
      id: "withFootnote",
      title: "脚注記事",
      category: "記事",
      created: "2026-01-01",
      updated: "2026-01-01",
      summary: "",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: ["本文[1]"],
        },
      ],
      footnotes: ["[[白磁海]]についての注釈"],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const model = buildArticlePageModel(graph, "withFootnote");
  assert.equal(model.footnotes.length, 1);
  assert.ok(model.footnotes[0].segments, "footnote should have segments");
  const linkSegment = model.footnotes[0].segments.find((s) => s.type === "link");
  assert.ok(linkSegment, "footnote should contain a resolved link segment");
  assert.equal(linkSegment.status, "resolved");
});

test("buildArticlePageModel resolves wikilinks in blockquote body", () => {
  const entries = [
    {
      id: "withQuote",
      title: "引用記事",
      category: "記事",
      created: "2026-01-01",
      updated: "2026-01-01",
      summary: "",
      sections: [
        {
          sourceHeading: "",
          heading: "概要",
          paragraphs: [
            {
              type: "blockquote",
              body: "[[白磁海]]は素晴らしい。",
            },
          ],
        },
      ],
    },
    ...fixtureEntries,
  ];

  const graph = buildWikiGraph(entries);
  const model = buildArticlePageModel(graph, "withQuote");
  const bq = model.sections[0].paragraphs[0];
  assert.equal(bq.type, "blockquote");
  assert.ok(bq.bodySegments, "blockquote should have bodySegments");
  const linkSegment = bq.bodySegments.find((s) => s.type === "link");
  assert.ok(linkSegment, "blockquote should contain a resolved link segment");
  assert.equal(linkSegment.status, "resolved");
});
