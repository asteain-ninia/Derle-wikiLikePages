function normalizeNewlines(value) {
  return String(value).replace(/\r\n?/g, "\n");
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseScalarValue(rawValue) {
  const value = stripWrappingQuotes(rawValue.trim());
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}

function replaceWikiMarkupWithPlainText(text) {
  return text.replace(/\[\[([^[\]]+?)\]\]/g, (_match, token) => {
    const [targetPart, displayPart] = token.split("|");
    const [pageTitle] = targetPart.split("#");
    const displayText = displayPart?.trim();

    return displayText || pageTitle.trim();
  });
}

function stripInlineHtml(text) {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[^>]+>/g, "");
}

function sanitizeInlineHtml(text) {
  return text.replace(/<(?!\/?(?:small|sup|sub|br)\b)[^>]+>/gi, "");
}

function stripInlineFormatting(text) {
  // 描画側 (renderInlineMarkdown) と同じく、単語内の _ は強調として扱わない
  return text
    .replace(/\[([^\]]+?)\]\(https?:\/\/[^)\s]+\)/g, "$1")
    .replace(/'''([^']+?)'''/g, "$1")
    .replace(/''([^']+?)''/g, "$1")
    .replace(/\*\*([^*]+?)\*\*/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])__([^_]+?)__(?![\p{L}\p{N}_])/gu, "$1$2")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/(^|[^\p{L}\p{N}_])_([^_\n]+?)_(?![\p{L}\p{N}_])/gu, "$1$2")
    .replace(/`([^`\n]+?)`/g, "$1");
}

function collapseSpaces(text) {
  return text.replace(/[ \t]+/g, " ").trim();
}

function normalizeInlineText(text) {
  return collapseSpaces(stripInlineFormatting(stripInlineHtml(text)));
}

function mergeParagraphLine(currentParagraph, nextLine) {
  if (!currentParagraph) {
    return nextLine;
  }

  if (
    /[A-Za-z0-9)]$/.test(currentParagraph) &&
    /^[A-Za-z0-9(]/.test(nextLine)
  ) {
    return `${currentParagraph} ${nextLine}`;
  }

  return `${currentParagraph}${nextLine}`;
}

function stripInlineTemplates(text) {
  let result = "";

  for (let index = 0; index < text.length; index += 1) {
    const pair = text.slice(index, index + 2);
    if (pair === "{{") {
      let depth = 1;
      index += 2;

      while (index < text.length && depth > 0) {
        const nestedPair = text.slice(index, index + 2);
        if (nestedPair === "{{") {
          depth += 1;
          index += 2;
          continue;
        }

        if (nestedPair === "}}") {
          depth -= 1;
          index += 2;
          continue;
        }

        index += 1;
      }

      index -= 1;
      continue;
    }

    result += text[index];
  }

  return result;
}

function parseListValue(rawValue) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return "";
  }

  return parseScalarValue(normalized);
}

export function parseFrontmatter(sourceText) {
  const source = normalizeNewlines(sourceText);
  if (!source.startsWith("---\n")) {
    return {
      data: {},
      body: source,
    };
  }

  const lines = source.split("\n");
  const data = {};
  let currentKey = "";
  let closingIndex = -1;

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.trim() === "---") {
      closingIndex = lineIndex;
      break;
    }

    if (!line.trim()) {
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (keyMatch) {
      const [, key, rawValue] = keyMatch;
      currentKey = key;

      if (!rawValue.trim()) {
        data[key] = [];
      } else {
        data[key] = parseScalarValue(rawValue);
      }

      continue;
    }

    const listItemMatch = /^\s*-\s*(.+)$/.exec(line);
    if (listItemMatch && currentKey) {
      const nextValue = parseListValue(listItemMatch[1]);
      if (Array.isArray(data[currentKey])) {
        data[currentKey].push(nextValue);
      } else {
        data[currentKey] = [nextValue];
      }
    }
  }

  if (closingIndex === -1) {
    return {
      data: {},
      body: source,
    };
  }

  return {
    data,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, ""),
  };
}

function parseTemplateLineContent(content) {
  const lines = content.split("\n");
  const firstLine = lines[0]?.trim() ?? "";
  const [namePart, ...positionalParts] = firstLine.split("|");
  const template = {
    name: namePart.trim(),
    positional: positionalParts.filter(Boolean).map((value) => value.trim()),
    params: {},
  };

  for (const line of lines.slice(1)) {
    const parameterMatch = /^\|\s*([^=]+?)\s*=\s*(.*)$/.exec(line.trim());
    if (parameterMatch) {
      const [, key, value] = parameterMatch;
      template.params[key.trim()] = value.trim();
      continue;
    }

    const positionalMatch = /^\|\s*(.+)$/.exec(line.trim());
    if (positionalMatch) {
      template.positional.push(positionalMatch[1].trim());
    }
  }

  return template;
}

export function extractLeadingTemplates(sourceText) {
  const source = normalizeNewlines(sourceText);
  const templates = [];
  const templateRanges = [];
  let cursor = 0;
  let skippedParagraph = false;

  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor])) {
      cursor += 1;
    }

    if (source.slice(cursor, cursor + 2) !== "{{") {
      if (skippedParagraph) {
        break;
      }

      // Skip past the first paragraph (non-template text before a blank line)
      // to find templates that appear after the intro paragraph
      const nextBlank = source.indexOf("\n\n", cursor);
      if (nextBlank === -1) {
        break;
      }
      cursor = nextBlank + 2;
      skippedParagraph = true;
      continue;
    }

    let depth = 0;
    let index = cursor;
    const templateStart = cursor;

    while (index < source.length) {
      const pair = source.slice(index, index + 2);
      if (pair === "{{") {
        depth += 1;
        index += 2;
        continue;
      }

      if (pair === "}}") {
        depth -= 1;
        index += 2;
        if (depth === 0) {
          const templateSource = source.slice(templateStart + 2, index - 2);
          templates.push(parseTemplateLineContent(templateSource.trim()));
          templateRanges.push({ start: templateStart, end: index });
          cursor = index;
          break;
        }

        continue;
      }

      index += 1;
    }

    if (depth !== 0) {
      break;
    }
  }

  // Build body by removing extracted template ranges
  let body = source;
  for (let i = templateRanges.length - 1; i >= 0; i -= 1) {
    const range = templateRanges[i];
    body = body.slice(0, range.start) + body.slice(range.end);
  }
  body = body.replace(/^\s+/, "").replace(/\n{3,}/g, "\n\n");

  return {
    templates,
    body,
  };
}

function inferTitle(frontmatter, introParagraphs, fileBasename) {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }

  const leadingParagraph = introParagraphs[0] ?? "";
  const boldTitleMatch = /^\*\*(.+?)\*\*/.exec(leadingParagraph)
    ?? /^'''(.+?)'''/.exec(leadingParagraph);
  if (boldTitleMatch) {
    return normalizeInlineText(replaceWikiMarkupWithPlainText(boldTitleMatch[1]));
  }

  return fileBasename;
}

function inferCategory(frontmatter, templates, title) {
  if (typeof frontmatter.category === "string" && frontmatter.category.trim()) {
    return frontmatter.category.trim();
  }

  if (templates.some((template) => template.name === "基礎情報 国")) {
    return "国家";
  }

  if (title.includes("諸国") || title.includes("圏") || title.includes("地方")) {
    return "地域";
  }

  if (
    /(共和国|帝国|王国|君主国|都市国|合議国|公国|国家|領国|自治領|都市国家)/.test(title)
  ) {
    return "国家";
  }

  return "記事";
}

function normalizeHeadingText(rawHeading) {
  return normalizeInlineText(replaceWikiMarkupWithPlainText(rawHeading));
}

function normalizeSectionText(rawParagraph) {
  return collapseSpaces(sanitizeInlineHtml(stripInlineTemplates(rawParagraph)));
}

function normalizeParagraphText(rawParagraph) {
  return normalizeInlineText(stripInlineTemplates(rawParagraph));
}

function parseCalloutLines(lines, startIndex) {
  const firstLine = lines[startIndex].trim();
  const calloutMatch = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(firstLine);
  if (!calloutMatch) {
    return null;
  }

  const calloutType = calloutMatch[1].toLowerCase();
  const title = calloutMatch[2].trim();
  const bodyLines = [];
  let endIndex = startIndex + 1;

  while (endIndex < lines.length) {
    const line = lines[endIndex].trim();
    if (line.startsWith("> ")) {
      bodyLines.push(line.slice(2));
      endIndex += 1;
      continue;
    }

    if (line === ">") {
      bodyLines.push("");
      endIndex += 1;
      continue;
    }

    break;
  }

  return {
    type: "callout",
    calloutType,
    title: title || calloutType,
    body: bodyLines.join("\n").trim(),
    endIndex,
  };
}

function parseMediaWikiTable(lines, startIndex) {
  if (!/^\{\|/.test(lines[startIndex].trim())) {
    return null;
  }

  const rows = [];
  let caption = "";
  let currentRow = null;
  let currentCell = null;
  let endIndex = startIndex + 1;

  function flushCell() {
    if (currentCell) {
      currentCell.text = currentCell.text.trim();
      if (!currentRow) {
        currentRow = [];
      }
      currentRow.push(currentCell);
      currentCell = null;
    }
  }

  function flushRow() {
    flushCell();
    if (currentRow && currentRow.length > 0) {
      rows.push(currentRow);
    }
    currentRow = null;
  }

  while (endIndex < lines.length) {
    const line = lines[endIndex].trim();

    if (line === "|}") {
      flushRow();
      endIndex += 1;
      break;
    }

    if (line.startsWith("|+")) {
      caption = line.slice(2).trim();
      endIndex += 1;
      continue;
    }

    if (line === "|-" || line.startsWith("|- ")) {
      flushRow();
      currentRow = [];
      endIndex += 1;
      continue;
    }

    if (line.startsWith("!")) {
      flushCell();
      if (!currentRow) {
        currentRow = [];
      }
      const headerContent = line.slice(1);
      const headerCells = headerContent.split("!!");
      for (const cellContent of headerCells) {
        const { attrs, text } = parseCellAttrsAndText(cellContent);
        flushCell();
        currentCell = { isHeader: true, text: text.trim(), ...attrs };
      }
      endIndex += 1;
      continue;
    }

    if (line.startsWith("|")) {
      flushCell();
      if (!currentRow) {
        currentRow = [];
      }
      const cellContent = line.slice(1);
      const dataCells = cellContent.split("||");
      for (const part of dataCells) {
        const { attrs, text } = parseCellAttrsAndText(part);
        flushCell();
        currentCell = { isHeader: false, text: text.trim(), ...attrs };
      }
      endIndex += 1;
      continue;
    }

    if (currentCell) {
      currentCell.text += "\n" + line;
    }
    endIndex += 1;
  }

  flushRow();
  return { type: "table", caption, rows, endIndex };
}

function parseCellAttrsAndText(raw) {
  const pipeIndex = raw.indexOf("|");
  if (pipeIndex === -1 || /\[\[/.test(raw.slice(0, pipeIndex))) {
    return { attrs: {}, text: raw };
  }

  const attrPart = raw.slice(0, pipeIndex).trim();
  const text = raw.slice(pipeIndex + 1);

  if (!/=/.test(attrPart)) {
    return { attrs: {}, text: raw };
  }

  const attrs = {};
  const rowspanMatch = /rowspan\s*=\s*"?(\d+)"?/i.exec(attrPart);
  if (rowspanMatch) {
    attrs.rowspan = Number(rowspanMatch[1]);
  }

  const colspanMatch = /colspan\s*=\s*"?(\d+)"?/i.exec(attrPart);
  if (colspanMatch) {
    attrs.colspan = Number(colspanMatch[1]);
  }

  return { attrs, text };
}

function extractBlockquotes(text) {
  const parts = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openIndex = text.indexOf("<blockquote>", cursor);
    if (openIndex === -1) {
      parts.push({ type: "text", value: text.slice(cursor) });
      break;
    }

    if (openIndex > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, openIndex) });
    }

    const closeIndex = text.indexOf("</blockquote>", openIndex);
    if (closeIndex === -1) {
      parts.push({ type: "text", value: text.slice(openIndex) });
      break;
    }

    const body = text.slice(openIndex + "<blockquote>".length, closeIndex).trim();
    parts.push({ type: "blockquote", body });
    cursor = closeIndex + "</blockquote>".length;
  }

  return parts;
}

function processFootnotes(text) {
  const footnotes = [];
  const processed = text.replace(/<ref(?:\s[^>]*)?>[\s\S]*?<\/ref>/gi, (match) => {
    const bodyMatch = /<ref(?:\s[^>]*)?>(.+?)<\/ref>/is.exec(match);
    if (!bodyMatch) {
      return "";
    }
    footnotes.push(bodyMatch[1].trim());
    return `[${footnotes.length}]`;
  });
  const cleaned = processed.replace(/<references\s*\/>/gi, "");
  return { text: cleaned, footnotes };
}

function convertMediaWikiImageToEmbed(text) {
  return text.replace(
    /\[\[(?:ファイル|File|Image):([^\]|]+?)(?:\|[^\]]*?)?\]\]/gi,
    (_match, fileName) => `![[${fileName.trim()}]]`
  );
}

function processNowiki(text) {
  const placeholders = [];
  const processed = text.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (_match, content) => {
    const index = placeholders.length;
    placeholders.push(content);
    return `\x00NOWIKI:${index}\x00`;
  });
  return { text: processed, placeholders };
}

function restoreNowiki(text, placeholders) {
  return text.replace(/\x00NOWIKI:(\d+)\x00/g, (_match, index) => {
    const content = placeholders[Number(index)] ?? "";
    return content
      .replace(/\[/g, "\uE010")
      .replace(/\]/g, "\uE011")
      .replace(/\{/g, "\uE012")
      .replace(/\}/g, "\uE013")
      .replace(/'/g, "\uE014")
      .replace(/\*/g, "\uE015")
      .replace(/`/g, "\uE016")
      .replace(/_/g, "\uE017");
  });
}

function stripMagicWords(text) {
  return text.replace(/__(?:TOC|NOTOC|FORCETOC|NOEDITSECTION)__/g, "");
}

function processRedirect(text) {
  const match = /^#REDIRECT\s*\[\[([^\]]+)\]\]/i.exec(text.trim());
  if (match) {
    return { isRedirect: true, redirectTarget: match[1].trim() };
  }
  return { isRedirect: false, redirectTarget: "" };
}

function parseInlineTagBlock(text, tagName) {
  const parts = [];
  let cursor = 0;
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;
  const openTagAlt = `<${tagName} `;

  while (cursor < text.length) {
    let openIndex = text.indexOf(openTag, cursor);
    const openIndexAlt = text.indexOf(openTagAlt, cursor);
    if (openIndex === -1 && openIndexAlt === -1) {
      parts.push({ type: "text", value: text.slice(cursor) });
      break;
    }
    if (openIndex === -1) openIndex = Infinity;
    const effectiveOpen = Math.min(openIndex, openIndexAlt === -1 ? Infinity : openIndexAlt);

    if (effectiveOpen > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, effectiveOpen) });
    }

    const closeTagStart = text.indexOf(closeTag, effectiveOpen);
    if (closeTagStart === -1) {
      parts.push({ type: "text", value: text.slice(effectiveOpen) });
      break;
    }

    const bodyStart = text.indexOf(">", effectiveOpen) + 1;
    const body = text.slice(bodyStart, closeTagStart);
    parts.push({ type: tagName, body });
    cursor = closeTagStart + closeTag.length;
  }
  return parts;
}

function extractCategoryTags(text) {
  const tags = [];
  const cleaned = text.replace(
    /\[\[Category:([^\]|]+?)(?:\|[^\]]*)?\]\]/gi,
    (_match, categoryName) => {
      tags.push(categoryName.trim());
      return "";
    }
  );
  return { text: cleaned, categoryTags: tags };
}

function buildParagraphs(lines) {
  const paragraphs = [];
  let currentParagraph = "";
  let lineIndex = 0;

  function flushParagraph() {
    if (!currentParagraph) {
      return;
    }

    const normalized = normalizeSectionText(currentParagraph);
    if (normalized) {
      paragraphs.push(normalized);
    }
    currentParagraph = "";
  }

  while (lineIndex < lines.length) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      lineIndex += 1;
      continue;
    }

    if (/^\{\|/.test(trimmed)) {
      flushParagraph();
      const table = parseMediaWikiTable(lines, lineIndex);
      if (table) {
        paragraphs.push({
          type: "table",
          caption: table.caption,
          rows: table.rows,
        });
        lineIndex = table.endIndex;
        continue;
      }
    }

    if (trimmed.includes("<blockquote>")) {
      flushParagraph();
      // Collect all lines until all blockquotes on this line/block are closed
      let content = "";
      let blockEndIndex = lineIndex;
      for (let i = lineIndex; i < lines.length; i += 1) {
        content += (i > lineIndex ? "\n" : "") + lines[i];
        blockEndIndex = i + 1;
        // Check if all opened blockquotes are closed
        const opens = (content.match(/<blockquote>/gi) || []).length;
        const closes = (content.match(/<\/blockquote>/gi) || []).length;
        if (closes >= opens) {
          break;
        }
      }

      const parts = extractBlockquotes(content);
      for (const part of parts) {
        if (part.type === "blockquote") {
          flushParagraph();
          paragraphs.push({ type: "blockquote", body: part.body });
        } else {
          const trimmedPart = part.value.trim();
          if (trimmedPart) {
            currentParagraph = mergeParagraphLine(currentParagraph, trimmedPart);
          }
        }
      }
      flushParagraph();
      lineIndex = blockEndIndex;
      continue;
    }

    if (/^<references\s*\/>$/i.test(trimmed)) {
      lineIndex += 1;
      continue;
    }

    // Horizontal rule: ---- (4+ dashes)
    if (/^-{4,}\s*$/.test(trimmed)) {
      flushParagraph();
      paragraphs.push({ type: "hr" });
      lineIndex += 1;
      continue;
    }

    // <poem> block
    if (/<poem>/i.test(trimmed)) {
      flushParagraph();
      let content = "";
      let poemEndIndex = lineIndex;
      for (let i = lineIndex; i < lines.length; i += 1) {
        content += (i > lineIndex ? "\n" : "") + lines[i];
        poemEndIndex = i + 1;
        if (/<\/poem>/i.test(lines[i])) {
          break;
        }
      }
      const poemMatch = /<poem>([\s\S]*?)<\/poem>/i.exec(content);
      if (poemMatch) {
        paragraphs.push({ type: "poem", body: poemMatch[1].trim() });
      }
      lineIndex = poemEndIndex;
      continue;
    }

    // <syntaxhighlight> / <source> block
    const codeTagMatch = /^<(syntaxhighlight|source)(?:\s[^>]*)?>/.exec(trimmed);
    if (codeTagMatch) {
      flushParagraph();
      const closingTag = codeTagMatch[1];
      let content = "";
      let codeEndIndex = lineIndex;
      for (let i = lineIndex; i < lines.length; i += 1) {
        content += (i > lineIndex ? "\n" : "") + lines[i];
        codeEndIndex = i + 1;
        if (new RegExp(`</${closingTag}>`, "i").test(lines[i])) {
          break;
        }
      }
      const codeMatch = new RegExp(`<${closingTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${closingTag}>`, "i").exec(content);
      const langMatch = /lang\s*=\s*"?(\w+)"?/i.exec(content);
      if (codeMatch) {
        paragraphs.push({
          type: "code-block",
          language: langMatch ? langMatch[1] : "",
          body: codeMatch[1],
        });
      }
      lineIndex = codeEndIndex;
      continue;
    }

    const callout = parseCalloutLines(lines, lineIndex);
    if (callout) {
      flushParagraph();
      paragraphs.push({
        type: "callout",
        calloutType: callout.calloutType,
        title: callout.title,
        body: callout.body,
      });
      lineIndex = callout.endIndex;
      continue;
    }

    const headingMatch = /^(#{2,6})\s+(.+)$/.exec(trimmed);
    const mwHeadingMatch = !headingMatch
      ? /^(={2,6})\s*(.+?)\s*=+\s*$/.exec(trimmed)
      : null;
    if (headingMatch || mwHeadingMatch) {
      flushParagraph();
      const match = headingMatch ?? mwHeadingMatch;
      paragraphs.push({
        type: "heading",
        level: match[1].length,
        text: match[2].trim(),
      });
      lineIndex += 1;
      continue;
    }

    // Definition list: ; term / : description
    const defTermMatch = /^;\s*(.+)$/.exec(trimmed);
    if (defTermMatch) {
      flushParagraph();
      const termPart = defTermMatch[1];
      // ; term : description on same line
      const colonSplit = termPart.indexOf(" : ");
      if (colonSplit !== -1) {
        paragraphs.push({
          type: "definition-list",
          items: [{
            term: normalizeSectionText(termPart.slice(0, colonSplit)),
            description: normalizeSectionText(termPart.slice(colonSplit + 3)),
          }],
        });
      } else {
        // Collect consecutive : lines as descriptions
        const term = normalizeSectionText(termPart);
        const descriptions = [];
        while (lineIndex + 1 < lines.length) {
          const nextLine = lines[lineIndex + 1].trim();
          const descMatch = /^:\s*(.+)$/.exec(nextLine);
          if (!descMatch) break;
          descriptions.push(normalizeSectionText(descMatch[1]));
          lineIndex += 1;
        }
        paragraphs.push({
          type: "definition-list",
          items: [{
            term,
            description: descriptions.join("\n"),
          }],
        });
      }
      lineIndex += 1;
      continue;
    }

    // Standalone : line (indent/continuation) — treat as definition description
    const standaloneDescMatch = /^:\s*(.+)$/.exec(trimmed);
    if (standaloneDescMatch) {
      flushParagraph();
      const text = normalizeSectionText(standaloneDescMatch[1]);
      if (text) {
        paragraphs.push(`　${text}`);
      }
      lineIndex += 1;
      continue;
    }

    // List items keep their MediaWiki-style marker string ("*", "#", "*#", ...):
    // its length is the nesting depth and each character is that level's list type.
    // Nested/mixed lists: **, ##, *#, #* etc.
    const nestedBulletMatch = /^([*#]{2,})\s+(.+)$/.exec(trimmed);
    if (nestedBulletMatch) {
      flushParagraph();
      const itemText = normalizeSectionText(nestedBulletMatch[2]);
      if (itemText) {
        paragraphs.push({ type: "list-item", markers: nestedBulletMatch[1], body: itemText });
      }
      lineIndex += 1;
      continue;
    }

    const bulletMatch =
      /^([*\-+])(?:\s+|(?=<))(.+)$/.exec(trimmed) ?? /^(・)\s*(.+)$/.exec(trimmed);
    const orderedMatch = /^(\d+)[.)]\s+(.+)$/.exec(trimmed)
      ?? /^(#)\s+(.+)$/.exec(trimmed);
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const itemText = bulletMatch ? bulletMatch[2] : orderedMatch?.[2] ?? "";
      const normalizedItem = normalizeSectionText(itemText);
      if (normalizedItem) {
        paragraphs.push({
          type: "list-item",
          markers: bulletMatch ? "*" : "#",
          body: normalizedItem,
        });
      }
      lineIndex += 1;
      continue;
    }

    const mainMatch = /^\x00MAIN:(.+?)\x00(.*)$/.exec(trimmed);
    if (mainMatch) {
      flushParagraph();
      const articleName = mainMatch[1].trim();
      paragraphs.push({
        type: "main-article",
        articleName,
      });
      const trailing = mainMatch[2].trim();
      if (trailing) {
        currentParagraph = trailing;
      }
      lineIndex += 1;
      continue;
    }

    currentParagraph = mergeParagraphLine(currentParagraph, line.trim());
    lineIndex += 1;
  }

  flushParagraph();
  return paragraphs;
}

export function parseMarkdownSections(sourceText) {
  const lines = normalizeNewlines(sourceText).split("\n");
  const tokens = buildParagraphs(lines);
  const sections = [];
  let currentSection = {
    rawHeading: "",
    heading: "概要",
    paragraphs: [],
  };

  function flushSection() {
    if (currentSection.paragraphs.length === 0 && !currentSection.rawHeading) {
      return;
    }

    sections.push({
      sourceHeading: currentSection.rawHeading,
      heading: currentSection.heading,
      paragraphs: currentSection.paragraphs,
    });
  }

  for (const token of tokens) {
    if (typeof token === "string") {
      currentSection.paragraphs.push(token);
      continue;
    }

    if (typeof token === "object" && token.type !== "heading") {
      currentSection.paragraphs.push(token);
      continue;
    }

    if (token.type === "heading") {
      flushSection();
      currentSection = {
        rawHeading: token.text,
        heading: normalizeHeadingText(token.text) || "節",
        paragraphs: [],
      };
    }
  }

  flushSection();

  if (
    sections.length >= 2 &&
    !sections[0].sourceHeading &&
    sections[0].heading === sections[1].heading
  ) {
    return [
      {
        ...sections[1],
        paragraphs: [...sections[0].paragraphs, ...sections[1].paragraphs],
      },
      ...sections.slice(2),
    ];
  }

  return sections;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function collectParagraphTexts(paragraph) {
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

function buildSummaryParagraphs(sections) {
  const collected = [];

  for (const section of sections) {
    for (const paragraph of section.paragraphs) {
      if (typeof paragraph !== "string") {
        continue;
      }

      collected.push(paragraph);
      if (collected.length >= 2) {
        return collected;
      }
    }
  }

  return collected;
}

function normalizePlainText(text) {
  return normalizeInlineText(replaceWikiMarkupWithPlainText(text));
}

function buildUniqueList(values, maxItems = Infinity) {
  const result = [];
  const seen = new Set();

  for (const value of values) {
    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= maxItems) {
      break;
    }
  }

  return result;
}

function extractWikiLinkTargets(text) {
  const matches = [];
  const pattern = /\[\[([^[\]]+?)\]\]/g;
  let match = pattern.exec(text);

  while (match) {
    const [targetPart] = match[1].split("|");
    const [pageTitle] = targetPart.split("#");
    if (pageTitle.trim()) {
      matches.push(pageTitle.trim());
    }

    match = pattern.exec(text);
  }

  return matches;
}

function buildTemplateModels(templates, templateHandlers) {
  if (!templateHandlers || templateHandlers.size === 0) {
    return [];
  }

  return templates
    .map((template) => {
      const handler = templateHandlers.get(template.name);
      return handler ? handler(template) : null;
    })
    .filter(Boolean);
}

export function findDuplicateEntryIds(entries) {
  const sourcePathsById = new Map();
  for (const entry of entries) {
    const sourcePaths = sourcePathsById.get(entry.id) ?? [];
    sourcePaths.push(entry.sourcePath);
    sourcePathsById.set(entry.id, sourcePaths);
  }

  return [...sourcePathsById]
    .filter(([, sourcePaths]) => sourcePaths.length > 1)
    .map(([id, sourcePaths]) => ({ id, sourcePaths }));
}

export function buildArticleRecord({
  relativePath,
  fileBasename,
  sourceText,
  created,
  updated,
  templateHandlers,
}) {
  const { data: frontmatter, body: sourceWithoutFrontmatter } = parseFrontmatter(sourceText);
  const { isRedirect, redirectTarget } = processRedirect(sourceWithoutFrontmatter);
  const { text: nowikiProcessed, placeholders: nowikiPlaceholders } =
    processNowiki(sourceWithoutFrontmatter);
  const magicStripped = stripMagicWords(nowikiProcessed);
  const { templates, body: bodyWithoutLeadingTemplates } =
    extractLeadingTemplates(magicStripped);
  const { text: bodyWithoutCategories, categoryTags } =
    extractCategoryTags(bodyWithoutLeadingTemplates);
  const bodyWithImages = convertMediaWikiImageToEmbed(bodyWithoutCategories);
  const { text: bodyWithFootnoteRefs, footnotes } = processFootnotes(bodyWithImages);
  const bodyWithMainConverted = bodyWithFootnoteRefs.replace(
    /\{\{main\|([^}]+)\}\}/gi,
    (_match, articleName) => `\x00MAIN:${articleName.trim()}\x00`
  );
  const cleanedBody = stripInlineTemplates(bodyWithMainConverted).trim();
  const restoredBody = restoreNowiki(cleanedBody, nowikiPlaceholders);
  const sections = parseMarkdownSections(restoredBody);
  const leadParagraphs = buildSummaryParagraphs(sections);
  const title = isRedirect ? redirectTarget : inferTitle(frontmatter, leadParagraphs, fileBasename);
  const aliases = buildUniqueList(
    [
      ...(Array.isArray(frontmatter.aliases) ? frontmatter.aliases : []),
      fileBasename !== title ? fileBasename : "",
    ],
    12
  );
  const tags = buildUniqueList([
    ...(Array.isArray(frontmatter.tags) ? frontmatter.tags : []),
    ...categoryTags,
    inferCategory(frontmatter, templates, title),
  ]);
  const allSourceText = [
    ...sections.flatMap((section) => [
      section.sourceHeading,
      ...section.paragraphs.flatMap(collectParagraphTexts),
    ]),
    ...footnotes,
  ]
    .filter(Boolean)
    .join("\n");
  const relatedTitles = buildUniqueList(extractWikiLinkTargets(allSourceText), 6);
  const keywords = buildUniqueList(
    [
      ...tags,
      ...relatedTitles,
      ...sections.map((section) => section.heading),
    ],
    8
  );
  const summarySource = normalizePlainText(frontmatter.summary ?? leadParagraphs[0] ?? title);
  const previewSource = normalizePlainText(
    leadParagraphs.length > 0 ? leadParagraphs.join(" ") : summarySource
  );

  return {
    id: relativePath.replace(/\\/g, "/").replace(/\.(md|wiki|txt)$/i, ""),
    title,
    aliases,
    category: inferCategory(frontmatter, templates, title),
    created,
    updated,
    summary: truncateText(summarySource, 96),
    preview: truncateText(previewSource, 220),
    tags,
    keywords,
    relatedTitles,
    sourcePath: relativePath.replace(/\\/g, "/"),
    templates: templates.map((template) => template.name),
    templateModels: buildTemplateModels(templates, templateHandlers),
    footnotes,
    sections,
    isRedirect,
    redirectTarget,
    draft: frontmatter.draft === true,
    isSample: relativePath.replace(/\\/g, "/").startsWith("samples/"),
  };
}
