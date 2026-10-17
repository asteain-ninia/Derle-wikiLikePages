import test from "node:test";
import assert from "node:assert/strict";

import { build, matchTemplate } from "../src/lib/templates/基礎情報.js";
import { createTemplateRegistry } from "../src/lib/template-registry.js";
import { buildArticleRecord } from "../src/lib/content-import.js";

test("matchTemplate accepts every 基礎情報 kind and the other infobox templates", () => {
  assert.ok(matchTemplate("基礎情報 国"));
  assert.ok(matchTemplate("基礎情報 地形"));
  assert.ok(matchTemplate("市"));
  assert.ok(matchTemplate("Infobox Language"));
  assert.ok(!matchTemplate("架空"));
  assert.ok(!matchTemplate("main"));
});

test("build uses 訳名 as heading and keeps the remaining non-empty params in source order", () => {
  const model = build({
    name: "基礎情報 地形",
    positional: [],
    params: { 訳名: "アシャン砂漠", 現地語名: "nuimi aCan", 種類: "砂漠", 所在地方: "", 所在大陸: "[[デーレ大陸]]" },
  });

  assert.equal(model.heading, "アシャン砂漠");
  assert.deepEqual(model.rows, [
    { label: "現地語名", value: "nuimi aCan" },
    { label: "種類", value: "砂漠" },
    { label: "所在大陸", value: "[[デーレ大陸]]" },
  ]);
});

test("build extracts images with captions and drops size and style params", () => {
  const model = build({
    name: "基礎情報 国",
    positional: [],
    params: {
      訳国名: "テスト国",
      国旗画像: "[[File:テスト国旗.png|100px|国旗]]",
      国旗画像px: "100px",
      国旗説明: "テスト国の国旗",
      ヘッダー色1: "#000000",
      首都: "{{WJL|首都市}}{{要出典|考察}}",
    },
  });

  assert.deepEqual(model.images, [{ src: "テスト国旗.png", caption: "テスト国の国旗" }]);
  assert.deepEqual(model.rows, [{ label: "首都", value: "首都市" }]);
});

test("build returns null when every param is empty", () => {
  assert.equal(build({ name: "基礎情報 言語", positional: [], params: { 訳名: "", 系統: "" } }), null);
});

test("registry prefers an exact templateName over a pattern handler", () => {
  const registry = createTemplateRegistry([
    { matchTemplate: (name) => name.startsWith("基礎情報 "), build: () => "pattern" },
    { templateName: "基礎情報 国", build: () => "exact" },
  ]);

  assert.equal(registry.get("基礎情報 国")(), "exact");
  assert.equal(registry.get("基礎情報 神")(), "pattern");
  assert.equal(registry.get("架空"), undefined);
});

test("buildArticleRecord keeps continuation lines of a template param and resolves image paths", () => {
  const record = buildArticleRecord({
    relativePath: "国/テスト国.md",
    fileBasename: "テスト国",
    created: "2026-01-01",
    updated: "2026-01-01",
    templateHandlers: createTemplateRegistry([{ matchTemplate, build }]),
    resolveAssetPath: (fileName) => `画像/${fileName}`,
    sourceText: "{{基礎情報 国\n|訳国名=テスト国\n|位置画像=位置.png\n|建国年月日=建国：100年\n共和制開始：200年\n}}\n本文\n\n![[地図.png]]\n",
  });

  const [infobox] = record.templateModels;
  assert.deepEqual(infobox.images, [{ src: "画像/位置.png", caption: "" }]);
  assert.deepEqual(infobox.rows, [{ label: "建国年月日", value: "建国：100年\n共和制開始：200年" }]);
  assert.match(JSON.stringify(record.sections), /!\[\[画像\/地図\.png\]\]/);
});
