import test from "node:test";
import assert from "node:assert/strict";

import { buildWikiGraph } from "../src/lib/article-page-model.js";
import {
  buildBacklinksArtifact,
  buildBuildArtifacts,
  buildDisambiguationArtifact,
  buildHistoryArtifact,
  buildMaintenanceReport,
  buildMissingPagesArtifact,
  buildRedirectsArtifact,
  measureTextLength,
  renderMaintenanceReportMarkdown,
} from "../src/lib/build-artifacts.js";

function entry(id, title, paragraphs, extra = {}) {
  return {
    id,
    title,
    aliases: [],
    category: "世界設定",
    created: "2026-03-01",
    updated: "2026-03-02",
    summary: "",
    sections: [{ heading: "概要", paragraphs }],
    ...extra,
  };
}

// hub → port / 調査記録 (曖昧) / 未作成港 / 自分の見出し
// port → hub (別名で) / 未作成港 / 自分自身
// lonely: どこからもリンクされず、未作成記事へのリンクだけを持つ
// survey-a / survey-b: 「調査記録」を別名に持つ。どこへもリンクしない
const fixtureEntries = [
  entry("hub", "白磁海", [
    "[[潮見港]]と[[調査記録]]と[[未作成港]]を参照する。[[#概要|上へ]]、![[map.png]]",
  ], { aliases: ["白海"] }),
  entry("port", "潮見港", ["[[白海]]と[[未作成港|港]]、[[潮見港]]自身。"], {
    sourcePath: "port.md",
    history: [{ date: "2026-03-02", message: "港を追加" }],
  }),
  entry("lonely", "孤島", ["[[未作成港]]と[[幻の島]]だけ。"]),
  entry("survey-a", "調査記録A", ["本文A"], { aliases: ["調査記録"] }),
  entry("survey-b", "調査記録B", ["本文B"], { aliases: ["調査記録", "調査B"] }),
];

test("buildWikiGraph は記事ごとの出リンクを記録し、同じ記事内の見出しリンクと埋め込みは数えない", () => {
  const graph = buildWikiGraph(fixtureEntries);

  assert.deepEqual(graph.outgoingLinksById.hub, {
    articleIds: ["port"],
    ambiguousTitles: ["調査記録"],
    missingTitles: ["未作成港"],
    linkCount: 3,
  });
  assert.deepEqual(graph.outgoingLinksById.port.articleIds, ["hub", "port"]);
  assert.equal(graph.outgoingLinksById.port.linkCount, 3);
  assert.equal(graph.missingPagesByTitle[""], undefined);
});

test("buildBacklinksArtifact は全記事の被リンク元を ID とタイトルで返す", () => {
  const backlinks = buildBacklinksArtifact(buildWikiGraph(fixtureEntries));

  assert.deepEqual(Object.keys(backlinks).sort(), ["hub", "lonely", "port", "survey-a", "survey-b"]);
  assert.deepEqual(backlinks.hub, { title: "白磁海", backlinks: [{ id: "port", title: "潮見港" }] });
  assert.deepEqual(backlinks.lonely.backlinks, []);
  // 自己リンクも SPA のバックリンク表示と同じく含める
  assert.deepEqual(
    backlinks.port.backlinks.map((ref) => ref.id).sort(),
    ["hub", "port"]
  );
});

test("buildMissingPagesArtifact は未解決リンクを参照元の多い順に並べる", () => {
  const missing = buildMissingPagesArtifact(buildWikiGraph(fixtureEntries));

  assert.deepEqual(
    missing.map(({ title, referenceCount }) => [title, referenceCount]),
    [
      ["未作成港", 3],
      ["幻の島", 1],
    ]
  );
  assert.deepEqual(missing[1].sourceEntries, [{ id: "lonely", title: "孤島" }]);
  assert.ok(Array.isArray(missing[0].suggestions));
  assert.deepEqual(Object.keys(missing[0].sourceEntries[0]), ["id", "title"]);
});

test("buildRedirectsArtifact は一意に決まる別名だけを正規ページに対応させる", () => {
  const redirects = buildRedirectsArtifact(buildWikiGraph(fixtureEntries));

  assert.deepEqual(redirects, {
    白海: { id: "hub", title: "白磁海" },
    調査B: { id: "survey-b", title: "調査記録B" },
  });
});

test("buildDisambiguationArtifact は複数の記事に対応する名前を、リンクされていなくても載せる", () => {
  const disambiguation = buildDisambiguationArtifact(
    buildWikiGraph([
      ...fixtureEntries,
      entry("bay-a", "入江", [], { aliases: [] }),
      entry("bay-b", "入江", [], { aliases: [] }),
    ])
  );

  assert.deepEqual(disambiguation, [
    {
      title: "調査記録",
      candidates: [
        { id: "survey-a", title: "調査記録A" },
        { id: "survey-b", title: "調査記録B" },
      ],
      sourceEntries: [{ id: "hub", title: "白磁海" }],
    },
    {
      title: "入江",
      candidates: [
        { id: "bay-a", title: "入江" },
        { id: "bay-b", title: "入江" },
      ],
      sourceEntries: [],
    },
  ].sort((left, right) => left.title.localeCompare(right.title, "ja-JP")));
});

test("buildHistoryArtifact は記事ごとの日付と Git 履歴をまとめる", () => {
  const history = buildHistoryArtifact(fixtureEntries);

  assert.deepEqual(history.port, {
    title: "潮見港",
    sourcePath: "port.md",
    created: "2026-03-01",
    updated: "2026-03-02",
    history: [{ date: "2026-03-02", message: "港を追加" }],
  });
  assert.deepEqual(history.lonely.history, []);
});

test("measureTextLength は空白を除き、リンクは表示される文字だけ数える", () => {
  assert.equal(measureTextLength(entry("x", "x", ["[[潮見港|港]] と ![[map.png]] 本文"])), 4); // 港と本文
  assert.equal(measureTextLength(entry("x", "x", ["[[潮見港]]"])), 3);
});

test("buildMaintenanceReport は孤立ページ・行き止まりページ・リンク密度を出す", () => {
  const report = buildMaintenanceReport(buildWikiGraph(fixtureEntries), {
    generatedAt: "2026-03-03T00:00:00.000Z",
  });

  assert.equal(report.generatedAt, "2026-03-03T00:00:00.000Z");
  // 自己リンクしか無い記事や、どこからも参照されない記事が孤立
  assert.deepEqual(
    report.orphans.map((row) => row.id).sort(),
    ["lonely", "survey-a", "survey-b"]
  );
  // 曖昧リンクは候補一覧へ進めるので行き止まりにしない。未作成記事へのリンクだけなら行き止まり
  assert.deepEqual(report.deadEnds, [
    { id: "lonely", title: "孤島", missingTitles: ["幻の島", "未作成港"].sort((a, b) => a.localeCompare(b, "ja-JP")) },
    { id: "survey-a", title: "調査記録A", missingTitles: [] },
    { id: "survey-b", title: "調査記録B", missingTitles: [] },
  ]);

  const port = report.linkDensity.find((row) => row.id === "port");
  assert.equal(port.outgoingArticleCount, 1);
  assert.equal(port.incomingCount, 1);
  assert.equal(port.missingCount, 1);
  assert.equal(port.linkCount, 3);
  assert.equal(port.linksPer1000Chars, Math.round((3 / port.textLength) * 1000 * 100) / 100);

  assert.deepEqual(report.summary, {
    articleCount: 5,
    linkCount: 8,
    articleLinkCount: 2,
    averageOutgoingArticles: 0.4,
    averageIncoming: 0.4,
    missingPageCount: 2,
    missingReferenceCount: 4,
    ambiguousNameCount: 1,
    orphanCount: 3,
    deadEndCount: 3,
  });
});

test("renderMaintenanceReportMarkdown は各節を出し、表のセル内の | をエスケープする", () => {
  const graph = buildWikiGraph([
    entry("a", "記事A", ["[[未作成|x]]と[[縦|棒]]"]),
  ]);
  const markdown = renderMaintenanceReportMarkdown(
    buildMaintenanceReport(graph, { generatedAt: "2026-03-03T00:00:00.000Z" })
  );

  for (const heading of ["## 概要", "## 孤立ページ", "## 行き止まりページ", "## 未解決リンク", "## 曖昧な名前", "## リンク密度"]) {
    assert.ok(markdown.includes(heading), heading);
  }
  assert.match(markdown, /\| 未作成 \| 1 \| 記事A \|/);
  assert.match(markdown, /- 記事A \(`a`\) — 未作成へのリンク: /);

  const escaped = renderMaintenanceReportMarkdown(
    buildMaintenanceReport(buildWikiGraph([entry("b", "B", ["[[A｜B]]"]), entry("c", "C|D", ["[[B]]"])]))
  );
  assert.match(escaped, /\| C\\\|D \|/);
});

test("buildBuildArtifacts は書き出すファイルを一式そろえる", () => {
  const { files, maintenanceReport } = buildBuildArtifacts(fixtureEntries, {
    generatedAt: "2026-03-03T00:00:00.000Z",
  });

  assert.deepEqual(Object.keys(files).sort(), [
    "backlinks.json",
    "disambiguation.json",
    "history.json",
    "maintenance-report.json",
    "maintenance-report.md",
    "missing-pages.json",
    "redirects.json",
  ]);
  assert.equal(files["maintenance-report.json"], maintenanceReport);
  assert.equal(typeof files["maintenance-report.md"], "string");
  // JSON として書き出せること
  for (const [name, content] of Object.entries(files)) {
    if (name.endsWith(".json")) {
      assert.doesNotThrow(() => JSON.parse(JSON.stringify(content)));
    }
  }
});
