// 「基礎情報 国」「基礎情報 地形」などすべての種別のインフォボックスを扱う汎用ハンドラ。
// パラメータを書かれた順に「項目名 / 値」の行として出し、空欄の項目は表示しない。

const OTHER_INFOBOX_TEMPLATES = new Set(["市", "架空言語概要", "Infobox Language"]);

const HEADING_KEYS = ["訳名", "訳国名", "自治体名", "名称", "name"];
const STYLE_KEY = /(色\d*|color)$/i;
const IMAGE_KEY = /画像$|^image$/i;
const IMAGE_SIZE_KEY = /(画像px|画像幅|px|size)$/i;
const IMAGE_FILE = /(?:\[\[\s*(?:File|ファイル|画像)\s*:|!\[\[)?\s*([^|[\]]+?\.(?:png|jpe?g|gif|webp|svg))/i;

export function matchTemplate(templateName) {
  return templateName.startsWith("基礎情報 ") || OTHER_INFOBOX_TEMPLATES.has(templateName);
}

function cleanValue(rawValue) {
  return (rawValue ?? "")
    .replace(/\{\{\s*WJL\s*\|\s*([^}|]+?)\s*\}\}/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .trim();
}

function imageCaptionKeys(imageKey) {
  const base = imageKey.replace(/画像$/, "");
  return [`${imageKey}説明`, `${base}説明`];
}

export function build(template) {
  const params = template.params ?? {};
  const headingKey = HEADING_KEYS.find((key) => cleanValue(params[key]));
  const heading = headingKey ? cleanValue(params[headingKey]) : template.positional?.[0] ?? "";

  const images = [];
  const consumedKeys = new Set(headingKey ? [headingKey] : []);

  for (const key of Object.keys(params)) {
    if (!IMAGE_KEY.test(key)) {
      continue;
    }

    consumedKeys.add(key);
    const fileMatch = IMAGE_FILE.exec(params[key] ?? "");
    const captionKey = imageCaptionKeys(key).find((candidate) => candidate in params);
    if (captionKey) {
      consumedKeys.add(captionKey);
    }
    if (fileMatch) {
      images.push({ src: fileMatch[1].trim(), caption: cleanValue(params[captionKey]) });
    }
  }

  const rows = Object.entries(params)
    .filter(([key]) => !consumedKeys.has(key) && !STYLE_KEY.test(key) && !IMAGE_SIZE_KEY.test(key))
    .map(([key, rawValue]) => ({ label: key, value: cleanValue(rawValue) }))
    .filter((row) => row.value && row.value !== "？" && row.value !== "?");

  // 項目がすべて空欄のインフォボックスは表示しない
  if (rows.length === 0 && images.length === 0) {
    return null;
  }

  return {
    type: "infobox",
    templateName: template.name,
    heading,
    images,
    rows,
  };
}
