// ビルド成果物 (backlinks.json などのリンク解決結果) と管理者向け保守レポートを組み立てる。
// リンク解決は article-page-model.js の buildWikiGraph をそのまま使い、ここでは形を整えるだけにする。
// どの関数も純粋関数で、ファイルへの書き出しは scripts/generate-content-data.mjs が行う。

import {
  buildWikiGraph,
  collectAllTextsFromEntry,
  extractWikiLinks,
} from "./article-page-model.js";

function normalizeName(value) {
  return String(value).trim().toLocaleLowerCase("ja-JP");
}

// 「あとで書く」の印として使っているリンク先。記事を作る予定の名前ではないので、
// 未解決リンク (missing-pages.json と保守レポート) には数えない。本文での表示は変えない
export const IGNORED_MISSING_TITLES = ["TODO"];
const ignoredMissingNames = new Set(IGNORED_MISSING_TITLES.map(normalizeName));

function isIgnoredMissingTitle(title) {
  return ignoredMissingNames.has(normalizeName(title));
}

function compareTitles(left, right) {
  return left.localeCompare(right, "ja-JP");
}

function toRef(entryLike) {
  return { id: entryLike.id, title: entryLike.title };
}

function sortRefs(refs) {
  return [...refs].sort((left, right) => compareTitles(left.title, right.title));
}

// 各記事の被リンク元 (自己リンクを含む。SPA のバックリンク表示と同じ)
export function buildBacklinksArtifact(graph) {
  return Object.fromEntries(
    [...graph.entries]
      .sort((left, right) => compareTitles(left.id, right.id))
      .map((entry) => [
        entry.id,
        {
          title: entry.title,
          backlinks: sortRefs((graph.backlinksById[entry.id] ?? []).map(toRef)),
        },
      ])
  );
}

// 未解決リンク (リンク先の記事が無い名前) の一覧。参照元が多い順
export function buildMissingPagesArtifact(graph) {
  return Object.values(graph.missingPagesByTitle)
    .filter((page) => !isIgnoredMissingTitle(page.title))
    .map((page) => ({
      title: page.title,
      referenceCount: page.sourceEntries.length,
      sourceEntries: sortRefs(page.sourceEntries.map(toRef)),
      suggestions: page.suggestions.map(toRef),
    }))
    .sort((left, right) => {
      if (right.referenceCount !== left.referenceCount) {
        return right.referenceCount - left.referenceCount;
      }
      return compareTitles(left.title, right.title);
    });
}

// 別名 → 正規ページの対応表。複数の記事が同じ名前を持つ場合は disambiguation.json 側に載せる
export function buildRedirectsArtifact(graph) {
  const redirects = {};

  for (const entry of graph.entries) {
    for (const alias of entry.aliases ?? []) {
      const normalized = normalizeName(alias);
      if (!normalized || normalized === normalizeName(entry.title)) {
        continue;
      }
      const entryIds = graph.referenceIndex.get(normalized) ?? [];
      if (entryIds.length === 1 && entryIds[0] === entry.id) {
        redirects[alias.trim()] = toRef(entry);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(redirects).sort(([left], [right]) => compareTitles(left, right))
  );
}

// 複数の記事に対応する名前 (タイトルまたは別名) の一覧。リンクされているかどうかに関係なく載せる
export function buildDisambiguationArtifact(graph) {
  const displayNames = new Map();
  for (const entry of graph.entries) {
    for (const name of [entry.title, ...(entry.aliases ?? [])]) {
      const normalized = normalizeName(name);
      if (normalized && !displayNames.has(normalized)) {
        displayNames.set(normalized, String(name).trim());
      }
    }
  }

  // 本文中の表記ゆれ (大文字小文字など) は正規化した名前でまとめる
  const sourcesByName = new Map();
  for (const page of Object.values(graph.disambiguationPagesByTitle)) {
    const normalized = normalizeName(page.title);
    const sources = sourcesByName.get(normalized) ?? new Map();
    for (const source of page.sourceEntries) {
      sources.set(source.id, toRef(source));
    }
    sourcesByName.set(normalized, sources);
  }

  return [...graph.referenceIndex.entries()]
    .filter(([, entryIds]) => entryIds.length > 1)
    .map(([normalized, entryIds]) => ({
      title: displayNames.get(normalized) ?? normalized,
      candidates: sortRefs(
        entryIds.map((entryId) => graph.entryById.get(entryId)).filter(Boolean).map(toRef)
      ),
      sourceEntries: sortRefs([...(sourcesByName.get(normalized)?.values() ?? [])]),
    }))
    .sort((left, right) => compareTitles(left.title, right.title));
}

// 記事ごとの作成日・更新日・Git 履歴
export function buildHistoryArtifact(entries) {
  return Object.fromEntries(
    [...entries]
      .sort((left, right) => compareTitles(left.id, right.id))
      .map((entry) => [
        entry.id,
        {
          title: entry.title,
          sourcePath: entry.sourcePath ?? "",
          created: entry.created ?? "",
          updated: entry.updated ?? "",
          history: entry.history ?? [],
        },
      ])
  );
}

// 本文の文字数 (空白を除く。wikilink は表示される文字だけ、埋め込みは数えない)
export function measureTextLength(entry) {
  let total = 0;

  for (const text of collectAllTextsFromEntry(entry)) {
    let visible = "";
    let cursor = 0;
    for (const link of extractWikiLinks(text)) {
      visible += text.slice(cursor, link.start);
      if (!link.isEmbed) {
        visible += link.displayText || link.pageTitle;
      }
      cursor = link.end;
    }
    visible += text.slice(cursor);
    total += [...visible.replace(/\s/g, "")].length;
  }

  return total;
}

function roundTo(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// 管理者向け保守レポート (spec 9.7)
// - 孤立ページ: 他の記事から一度もリンクされていない記事 (自己リンクは数えない)
// - 行き止まりページ: 他の既存記事へのリンクが無い記事 (曖昧リンクは候補一覧へ進めるので数える。
//   未作成記事へのリンクと自己リンクは数えない)
// - リンク密度: 記事ごとの出リンク・被リンク・未解決リンクの数と、本文 1000 字あたりのリンク数
export function buildMaintenanceReport(graph, { generatedAt = new Date().toISOString() } = {}) {
  const missingPages = buildMissingPagesArtifact(graph);
  const disambiguation = buildDisambiguationArtifact(graph);

  const linkDensity = graph.entries.map((entry) => {
    const outgoing = graph.outgoingLinksById[entry.id];
    const outgoingArticleCount = outgoing.articleIds.filter((id) => id !== entry.id).length;
    const incomingCount = (graph.backlinksById[entry.id] ?? []).filter(
      (source) => source.id !== entry.id
    ).length;
    const textLength = measureTextLength(entry);
    const missingTitles = outgoing.missingTitles.filter((title) => !isIgnoredMissingTitle(title));

    return {
      id: entry.id,
      title: entry.title,
      outgoingArticleCount,
      incomingCount,
      ambiguousCount: outgoing.ambiguousTitles.length,
      missingCount: missingTitles.length,
      linkCount: outgoing.linkCount,
      textLength,
      linksPer1000Chars: textLength > 0 ? roundTo((outgoing.linkCount / textLength) * 1000, 2) : 0,
    };
  });
  linkDensity.sort((left, right) => compareTitles(left.title, right.title));

  const orphans = linkDensity
    .filter((row) => row.incomingCount === 0)
    .map((row) => ({ id: row.id, title: row.title, outgoingArticleCount: row.outgoingArticleCount }));

  const deadEnds = linkDensity
    .filter((row) => row.outgoingArticleCount === 0 && row.ambiguousCount === 0)
    .map((row) => ({
      id: row.id,
      title: row.title,
      missingTitles: graph.outgoingLinksById[row.id].missingTitles
        .filter((title) => !isIgnoredMissingTitle(title))
        .sort(compareTitles),
    }));

  const articleCount = graph.entries.length;
  const sum = (key) => linkDensity.reduce((total, row) => total + row[key], 0);

  return {
    generatedAt,
    summary: {
      articleCount,
      linkCount: sum("linkCount"),
      articleLinkCount: sum("outgoingArticleCount"),
      averageOutgoingArticles: articleCount ? roundTo(sum("outgoingArticleCount") / articleCount, 2) : 0,
      averageIncoming: articleCount ? roundTo(sum("incomingCount") / articleCount, 2) : 0,
      missingPageCount: missingPages.length,
      missingReferenceCount: missingPages.reduce((total, page) => total + page.referenceCount, 0),
      ambiguousNameCount: disambiguation.length,
      orphanCount: orphans.length,
      deadEndCount: deadEnds.length,
    },
    orphans,
    deadEnds,
    missingPages: missingPages.map(({ title, referenceCount, sourceEntries }) => ({
      title,
      referenceCount,
      sourceEntries,
    })),
    ambiguousNames: disambiguation.map(({ title, candidates, sourceEntries }) => ({
      title,
      candidates,
      sourceEntries,
    })),
    linkDensity,
  };
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatRefs(refs) {
  return refs.length > 0 ? refs.map((ref) => ref.title).join("、") : "—";
}

export function renderMaintenanceReportMarkdown(report) {
  const { summary } = report;
  const lines = [];

  lines.push("# 保守レポート", "");
  lines.push(`生成: ${report.generatedAt} (\`npm run build:content\` が書き出す。手で編集しない)`, "");

  lines.push("## 概要", "");
  lines.push("| 項目 | 値 |", "| --- | --- |");
  lines.push(`| 記事数 | ${summary.articleCount} |`);
  lines.push(`| 内部リンク (出現数) | ${summary.linkCount} |`);
  lines.push(`| 記事間リンク (重複除く) | ${summary.articleLinkCount} |`);
  lines.push(`| 1 記事あたりの出リンク / 被リンク | ${summary.averageOutgoingArticles} / ${summary.averageIncoming} |`);
  lines.push(`| 未解決リンク (名前 / 参照数) | ${summary.missingPageCount} / ${summary.missingReferenceCount} |`);
  lines.push(`| 曖昧な名前 | ${summary.ambiguousNameCount} |`);
  lines.push(`| 孤立ページ | ${summary.orphanCount} |`);
  lines.push(`| 行き止まりページ | ${summary.deadEndCount} |`);
  lines.push("");

  lines.push("## 孤立ページ", "", "他の記事から一度もリンクされていない記事。", "");
  if (report.orphans.length === 0) {
    lines.push("なし", "");
  } else {
    for (const row of report.orphans) {
      lines.push(`- ${row.title} (\`${row.id}\`)`);
    }
    lines.push("");
  }

  lines.push(
    "## 行き止まりページ",
    "",
    "他の既存記事へのリンクが無い記事 (未作成記事へのリンクだけの記事を含む)。",
    ""
  );
  if (report.deadEnds.length === 0) {
    lines.push("なし", "");
  } else {
    for (const row of report.deadEnds) {
      const note = row.missingTitles.length > 0 ? ` — 未作成へのリンク: ${row.missingTitles.join("、")}` : "";
      lines.push(`- ${row.title} (\`${row.id}\`)${note}`);
    }
    lines.push("");
  }

  lines.push(
    "## 未解決リンク",
    "",
    `リンク先の記事が無い名前。参照元が多い順。${IGNORED_MISSING_TITLES.join("・")} へのリンクは数えない。`,
    ""
  );
  if (report.missingPages.length === 0) {
    lines.push("なし", "");
  } else {
    lines.push("| 名前 | 参照元数 | 参照元 |", "| --- | ---: | --- |");
    for (const page of report.missingPages) {
      lines.push(
        `| ${escapeTableCell(page.title)} | ${page.referenceCount} | ${escapeTableCell(formatRefs(page.sourceEntries))} |`
      );
    }
    lines.push("");
  }

  lines.push("## 曖昧な名前", "", "複数の記事のタイトル・別名になっている名前。", "");
  if (report.ambiguousNames.length === 0) {
    lines.push("なし", "");
  } else {
    lines.push("| 名前 | 候補 | 参照元 |", "| --- | --- | --- |");
    for (const name of report.ambiguousNames) {
      lines.push(
        `| ${escapeTableCell(name.title)} | ${escapeTableCell(formatRefs(name.candidates))} | ${escapeTableCell(formatRefs(name.sourceEntries))} |`
      );
    }
    lines.push("");
  }

  lines.push(
    "## リンク密度",
    "",
    "1000 字あたりのリンク数が少ない順。字数は空白を除いた本文・表・脚注・インフォボックスの文字数。",
    ""
  );
  lines.push(
    "| 記事 | 出リンク | 被リンク | 未解決 | 曖昧 | 字数 | 1000 字あたり |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  );
  const densityRows = [...report.linkDensity].sort((left, right) => {
    if (left.linksPer1000Chars !== right.linksPer1000Chars) {
      return left.linksPer1000Chars - right.linksPer1000Chars;
    }
    return compareTitles(left.title, right.title);
  });
  for (const row of densityRows) {
    lines.push(
      `| ${escapeTableCell(row.title)} | ${row.outgoingArticleCount} | ${row.incomingCount} | ${row.missingCount} | ${row.ambiguousCount} | ${row.textLength} | ${row.linksPer1000Chars} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

// generate-content-data.mjs が書き出すファイル名 → 中身
export function buildBuildArtifacts(entries, options = {}) {
  const graph = buildWikiGraph(entries);
  const maintenanceReport = buildMaintenanceReport(graph, options);

  return {
    graph,
    maintenanceReport,
    files: {
      "backlinks.json": buildBacklinksArtifact(graph),
      "missing-pages.json": buildMissingPagesArtifact(graph),
      "redirects.json": buildRedirectsArtifact(graph),
      "disambiguation.json": buildDisambiguationArtifact(graph),
      "history.json": buildHistoryArtifact(entries),
      "maintenance-report.json": maintenanceReport,
      "maintenance-report.md": renderMaintenanceReportMarkdown(maintenanceReport),
    },
  };
}
