export function collectTextsFromParagraph(paragraph) {
  if (typeof paragraph === "string") {
    return [paragraph];
  }

  if (!paragraph || typeof paragraph !== "object") {
    return [];
  }

  const texts = [];

  // Collect text from table cells
  if (paragraph.rows) {
    for (const row of paragraph.rows) {
      for (const cell of row) {
        if (cell.text) {
          texts.push(cell.text);
        }
      }
    }
  }

  // Collect from known text-bearing fields
  if (paragraph.body) {
    texts.push(paragraph.body);
  }

  if (paragraph.articleName) {
    texts.push(`[[${paragraph.articleName}]]`);
  }

  if (paragraph.title && paragraph.type !== "callout") {
    texts.push(paragraph.title);
  }

  if (paragraph.caption) {
    texts.push(paragraph.caption);
  }

  if (paragraph.items) {
    for (const item of paragraph.items) {
      if (item.term) texts.push(item.term);
      if (item.description) texts.push(item.description);
    }
  }

  return texts;
}

function collectAllTextsFromEntry(entry) {
  const texts = [];

  for (const section of entry.sections ?? []) {
    texts.push(
      ...[section.sourceHeading, ...(section.paragraphs ?? [])].flatMap(
        (paragraph) => collectTextsFromParagraph(paragraph)
      )
    );
  }

  for (const footnote of entry.footnotes ?? []) {
    texts.push(footnote);
  }

  for (const model of entry.templateModels ?? []) {
    if (model.rows) {
      for (const row of model.rows) {
        if (row.value) texts.push(row.value);
      }
    }
    if (model.text) texts.push(model.text);
  }

  return texts.filter(Boolean);
}

function normalizeLookupValue(value) {
  return String(value).trim().toLocaleLowerCase("ja-JP");
}

function normalizeSimilarityValue(value) {
  return normalizeLookupValue(value).replace(/[\s\-_　]/g, "");
}

function createEntrySummary(entry) {
  return {
    id: entry.id,
    title: entry.title,
    category: entry.category,
    summary: entry.summary,
    updated: entry.updated,
  };
}

function sortEntrySummaries(entries) {
  return [...entries].sort((left, right) => {
    const updatedComparison = right.updated.localeCompare(left.updated);
    if (updatedComparison !== 0) {
      return updatedComparison;
    }

    return left.title.localeCompare(right.title, "ja-JP");
  });
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const current = previous[column];
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;

      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + cost
      );

      diagonal = current;
    }
  }

  return previous[right.length];
}

function scoreReferenceSimilarity(referenceTitle, candidateValue) {
  const normalizedReference = normalizeSimilarityValue(referenceTitle);
  const normalizedCandidate = normalizeSimilarityValue(candidateValue);

  if (!normalizedReference || !normalizedCandidate) {
    return 0;
  }

  if (normalizedReference === normalizedCandidate) {
    return 1;
  }

  const maxLength = Math.max(normalizedReference.length, normalizedCandidate.length);
  const editScore = 1 - levenshteinDistance(normalizedReference, normalizedCandidate) / maxLength;

  if (
    normalizedReference.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedReference)
  ) {
    return Math.max(editScore, Math.min(0.96, editScore + 0.2));
  }

  return editScore;
}

function findSuggestedEntries(entries, referenceTitle, maxSuggestions = 3) {
  return [...entries]
    .map((entry) => {
      const candidateValues = [entry.title, ...(entry.aliases ?? [])];
      const score = candidateValues.reduce((bestScore, value) => {
        return Math.max(bestScore, scoreReferenceSimilarity(referenceTitle, value));
      }, 0);

      return {
        entry,
        score,
      };
    })
    .filter(({ score }) => score >= 0.34)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.entry.updated.localeCompare(left.entry.updated);
    })
    .slice(0, maxSuggestions)
    .map(({ entry }) => createEntrySummary(entry));
}

function parseLinkToken(token) {
  const [targetPart, displayPart] = token.split("|");
  const [pageTitlePart, headingPart] = targetPart.split("#");

  return {
    pageTitle: pageTitlePart.trim(),
    heading: headingPart?.trim() ?? "",
    displayText: displayPart?.trim() ?? "",
  };
}

function buildReferenceLabel(link, fallbackTitle) {
  if (link.displayText) {
    return link.displayText;
  }

  if (link.heading) {
    return `${fallbackTitle}#${link.heading}`;
  }

  return fallbackTitle;
}

export function buildArticleHref(entryId, heading = "") {
  const encodedEntryId = encodeURIComponent(entryId);
  if (!heading) {
    return `#!article/${encodedEntryId}`;
  }

  return `#!article/${encodedEntryId}/${encodeURIComponent(heading)}`;
}

export function buildMissingPageHref(title) {
  return `#!missing/${encodeURIComponent(title)}`;
}

export function buildDisambiguationHref(title) {
  return `#!disambiguation/${encodeURIComponent(title)}`;
}

export function buildSectionAnchorId(heading) {
  return `section-${encodeURIComponent(heading).replace(/%/g, "-").toLowerCase()}`;
}

export function parseAppRoute(hash) {
  if (!hash.startsWith("#!")) {
    return { view: "home" };
  }

  const route = hash.slice(2);
  const parts = route.split("/");
  const view = parts[0];

  if (view === "article" && parts[1]) {
    return {
      view: "article",
      entryId: decodeURIComponent(parts[1]),
      sectionHeading: parts[2] ? decodeURIComponent(parts.slice(2).join("/")) : "",
    };
  }

  if (view === "missing" && parts[1]) {
    return {
      view: "missing",
      title: decodeURIComponent(parts.slice(1).join("/")),
    };
  }

  if (view === "disambiguation" && parts[1]) {
    return {
      view: "disambiguation",
      title: decodeURIComponent(parts.slice(1).join("/")),
    };
  }

  if (view === "category" && parts[1]) {
    return {
      view: "category",
      category: decodeURIComponent(parts.slice(1).join("/")),
    };
  }

  return { view: "home" };
}

export function extractWikiLinks(text) {
  const matches = [];
  const pattern = /(!?)\[\[([^[\]]+?)\]\]/g;
  let match = pattern.exec(text);

  while (match) {
    const isEmbed = match[1] === "!";
    matches.push({
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
      isEmbed,
      ...parseLinkToken(match[2]),
    });

    match = pattern.exec(text);
  }

  return matches;
}

export function buildReferenceIndex(entries) {
  const referenceIndex = new Map();

  function addReference(referenceName, entryId) {
    const normalized = normalizeLookupValue(referenceName);
    if (!normalized) {
      return;
    }

    const entryIds = referenceIndex.get(normalized) ?? [];
    if (!entryIds.includes(entryId)) {
      entryIds.push(entryId);
    }

    referenceIndex.set(normalized, entryIds);
  }

  for (const entry of entries) {
    addReference(entry.title, entry.id);

    for (const alias of entry.aliases ?? []) {
      addReference(alias, entry.id);
    }
  }

  return referenceIndex;
}

export function resolveArticleReference(referenceIndex, entryById, referenceTitle) {
  const resolvedIds = referenceIndex.get(normalizeLookupValue(referenceTitle)) ?? [];

  if (resolvedIds.length === 1) {
    const entry = entryById.get(resolvedIds[0]) ?? null;

    if (entry) {
      return {
        type: "article",
        entry,
      };
    }
  }

  if (resolvedIds.length > 1) {
    return {
      type: "ambiguous",
      title: referenceTitle,
      candidates: sortEntrySummaries(
        resolvedIds
          .map((entryId) => entryById.get(entryId))
          .filter(Boolean)
          .map((entry) => createEntrySummary(entry))
      ),
    };
  }

  return {
    type: "missing",
    title: referenceTitle,
  };
}

export function buildWikiGraph(entries) {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const referenceIndex = buildReferenceIndex(entries);
  const backlinkMapsById = new Map(entries.map((entry) => [entry.id, new Map()]));
  const missingPagesByTitle = new Map();
  const disambiguationPagesByTitle = new Map();

  function registerMissingTitle(referenceTitle, sourceEntry) {
    const page = missingPagesByTitle.get(referenceTitle) ?? {
      title: referenceTitle,
      sourceEntries: new Map(),
    };

    page.sourceEntries.set(sourceEntry.id, createEntrySummary(sourceEntry));
    missingPagesByTitle.set(referenceTitle, page);
  }

  function registerDisambiguationTitle(referenceTitle, candidates, sourceEntry) {
    const page = disambiguationPagesByTitle.get(referenceTitle) ?? {
      title: referenceTitle,
      candidates,
      sourceEntries: new Map(),
    };

    page.sourceEntries.set(sourceEntry.id, createEntrySummary(sourceEntry));
    disambiguationPagesByTitle.set(referenceTitle, page);
  }

  for (const entry of entries) {
    for (const text of collectAllTextsFromEntry(entry)) {
      for (const link of extractWikiLinks(text)) {
        if (link.isEmbed) {
          continue;
        }

        const resolution = resolveArticleReference(referenceIndex, entryById, link.pageTitle);

        if (resolution.type === "article") {
          const backlinks = backlinkMapsById.get(resolution.entry.id);
          backlinks?.set(entry.id, createEntrySummary(entry));
          continue;
        }

        if (resolution.type === "ambiguous") {
          registerDisambiguationTitle(link.pageTitle, resolution.candidates, entry);
          continue;
        }

        registerMissingTitle(link.pageTitle, entry);
      }
    }
  }

  const backlinksById = Object.fromEntries(
    [...backlinkMapsById.entries()].map(([entryId, backlinkMap]) => {
      return [entryId, sortEntrySummaries([...backlinkMap.values()])];
    })
  );

  const finalizedMissingPages = Object.fromEntries(
    [...missingPagesByTitle.entries()].map(([title, page]) => {
      return [
        title,
        {
          title,
          sourceEntries: sortEntrySummaries([...page.sourceEntries.values()]),
          suggestions: findSuggestedEntries(entries, title),
        },
      ];
    })
  );

  const finalizedDisambiguationPages = Object.fromEntries(
    [...disambiguationPagesByTitle.entries()].map(([title, page]) => {
      return [
        title,
        {
          title,
          candidates: sortEntrySummaries(page.candidates),
          sourceEntries: sortEntrySummaries([...page.sourceEntries.values()]),
        },
      ];
    })
  );

  return {
    entries,
    entryById,
    referenceIndex,
    backlinksById,
    missingPagesByTitle: finalizedMissingPages,
    disambiguationPagesByTitle: finalizedDisambiguationPages,
  };
}

export function buildWikiTextSegments(text, graph) {
  const links = extractWikiLinks(text);

  if (links.length === 0) {
    return [{ type: "text", value: text }];
  }

  const segments = [];
  let cursor = 0;

  for (const link of links) {
    if (link.start > cursor) {
      segments.push({
        type: "text",
        value: text.slice(cursor, link.start),
      });
    }

    if (link.isEmbed) {
      segments.push({
        type: "embed",
        src: link.pageTitle,
        alt: link.displayText || link.pageTitle.split("/").pop(),
      });
      cursor = link.end;
      continue;
    }

    const resolution = resolveArticleReference(graph.referenceIndex, graph.entryById, link.pageTitle);

    if (resolution.type === "article") {
      segments.push({
        type: "link",
        status: "resolved",
        href: buildArticleHref(resolution.entry.id, link.heading),
        label: buildReferenceLabel(link, resolution.entry.title),
        title: resolution.entry.title,
      });
    } else if (resolution.type === "ambiguous") {
      segments.push({
        type: "link",
        status: "ambiguous",
        href: buildDisambiguationHref(link.pageTitle),
        label: buildReferenceLabel(link, link.pageTitle),
        title: link.pageTitle,
      });
    } else {
      segments.push({
        type: "link",
        status: "missing",
        href: buildMissingPageHref(link.pageTitle),
        label: buildReferenceLabel(link, link.pageTitle),
        title: link.pageTitle,
      });
    }

    cursor = link.end;
  }

  if (cursor < text.length) {
    segments.push({
      type: "text",
      value: text.slice(cursor),
    });
  }

  return segments;
}

export function buildArticlePageModel(graph, entryId) {
  const entry = graph.entryById.get(entryId) ?? null;

  if (!entry) {
    return null;
  }

  let unresolvedLinkCount = 0;
  const sections = (entry.sections ?? []).map((section) => {
    const paragraphs = (section.paragraphs ?? []).map((paragraph) => {
      if (typeof paragraph === "object" && paragraph.type === "callout") {
        const bodySegments = buildWikiTextSegments(paragraph.body, graph);
        unresolvedLinkCount += bodySegments.filter(
          (segment) => segment.type === "link" && segment.status !== "resolved"
        ).length;
        return {
          type: "callout",
          calloutType: paragraph.calloutType,
          title: paragraph.title,
          bodySegments,
        };
      }

      if (typeof paragraph === "object" && paragraph.type === "table") {
        const resolvedRows = paragraph.rows.map((row) =>
          row.map((cell) => ({
            ...cell,
            segments: buildWikiTextSegments(cell.text, graph),
          }))
        );
        return { ...paragraph, rows: resolvedRows };
      }

      if (typeof paragraph === "object" && paragraph.type === "blockquote") {
        const bodySegments = buildWikiTextSegments(paragraph.body, graph);
        return { ...paragraph, bodySegments };
      }

      if (typeof paragraph === "object" && paragraph.type === "list-item") {
        const bodySegments = buildWikiTextSegments(paragraph.body, graph);
        unresolvedLinkCount += bodySegments.filter(
          (segment) => segment.type === "link" && segment.status !== "resolved"
        ).length;
        return { ...paragraph, bodySegments };
      }

      if (typeof paragraph === "object" && paragraph.type === "main-article") {
        const segments = buildWikiTextSegments(`[[${paragraph.articleName}]]`, graph);
        return { ...paragraph, segments };
      }

      if (typeof paragraph === "object" && paragraph.type === "poem") {
        const bodySegments = buildWikiTextSegments(paragraph.body, graph);
        return { ...paragraph, bodySegments };
      }

      if (typeof paragraph === "object" && paragraph.type === "definition-list") {
        const items = paragraph.items.map((item) => ({
          termSegments: buildWikiTextSegments(item.term, graph),
          descriptionSegments: buildWikiTextSegments(item.description, graph),
        }));
        return { ...paragraph, items };
      }

      // hr, code-block, and other objects pass through unchanged
      if (typeof paragraph === "object" && !Array.isArray(paragraph)) {
        return paragraph;
      }

      const segments = buildWikiTextSegments(paragraph, graph);
      unresolvedLinkCount += segments.filter(
        (segment) => segment.type === "link" && segment.status !== "resolved"
      ).length;
      return segments;
    });

    return {
      heading: section.heading,
      anchorId: buildSectionAnchorId(section.heading),
      paragraphs,
    };
  });

  const templateModels = (entry.templateModels ?? []).map((model) => {
    if (model.type === "infobox") {
      return {
        ...model,
        rows: model.rows.map((row) => ({
          label: row.label,
          value: row.value,
          segments: buildWikiTextSegments(row.value, graph),
        })),
      };
    }

    return model;
  });

  return {
    ...entry,
    aliases: entry.aliases ?? [],
    tags: entry.tags ?? [],
    footnotes: (entry.footnotes ?? []).map((note) => ({
      text: note,
      segments: buildWikiTextSegments(note, graph),
    })),
    sections,
    templateModels,
    backlinks: graph.backlinksById[entry.id] ?? [],
    unresolvedLinkCount,
  };
}

export function buildMissingPageModel(graph, title) {
  return graph.missingPagesByTitle[title] ?? {
    title,
    sourceEntries: [],
    suggestions: findSuggestedEntries(graph.entries, title),
  };
}

export function buildDisambiguationPageModel(graph, title) {
  return graph.disambiguationPagesByTitle[title] ?? null;
}
