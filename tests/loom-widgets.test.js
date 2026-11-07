import test from "node:test";
import assert from "node:assert/strict";

import { expandLoomTemplates, parseMarkdownSections } from "../src/lib/content-import.js";
import { renderLoomCalculator } from "../src/lib/loom/widgets.js";
import { formatNumber } from "../src/lib/loom/quantities.js";
import { earthToLocal, localToEarth } from "../src/lib/loom/calendar.js";
import { getDerleSystem } from "../src/lib/loom/system.js";
import { renderStaticDocument } from "../src/lib/static-pages.js";

test("{{織機|量|単位|桁}} はビルド時の計算値になる", () => {
  assert.equal(expandLoomTemplates("半径は {{織機|惑星の半径|km|6}} km"), "半径は 6,682.34 km");
  assert.equal(expandLoomTemplates("{{織機|惑星の半径|pasqil|4}}"), "5.950");
  assert.equal(expandLoomTemplates("{{織機|地表平均温度|gal}}"), "59.01");
  assert.equal(expandLoomTemplates("{{織機|朔望月|日|5}}"), "28.929");
  // 「地球の重力」は惑星の重力の地球比と同じ基準
  const { system } = getDerleSystem();
  assert.equal(expandLoomTemplates("{{織機|表面重力|地球の重力|6}}"), formatNumber(system.planet.gravity, 6));
});

test("{{織機}} の誤りは目に見える印になる", () => {
  assert.match(expandLoomTemplates("{{織機|ない量|km}}"), /〔織機: 量「ない量」はありません〕/);
  assert.match(expandLoomTemplates("{{織機|惑星の半径|kg}}"), /〔織機: 「長さ」に単位「kg」はありません〕/);
});

test("{{計算機|種類}} の行は計算機のブロックになる", () => {
  const sections = parseMarkdownSections(expandLoomTemplates("前の段落\n\n{{計算機|単位}}\n\n後の段落"));
  const paragraphs = sections.flatMap((section) => section.paragraphs);
  assert.deepEqual(
    paragraphs.find((p) => p.type === "calculator"),
    { type: "calculator", kind: "単位" }
  );
});

test("計算機の HTML は JavaScript なしでも例の値を含む", () => {
  const html = renderLoomCalculator("単位");
  assert.match(html, /data-loom-calc="単位"/);
  assert.match(html, /<th scope="row">km<\/th><td>1,123\.00<\/td>/);
  assert.match(renderLoomCalculator("時刻"), /シェル暦 2551 年の 9 日目 3 時 26 分 40 秒/);
  assert.match(renderLoomCalculator("ない"), /計算機「ない」はありません/);
});

test("静的ページは計算機があるときだけスクリプトを読む", () => {
  const base = { siteName: "s", documentTitle: "t", title: "t", description: "", canonicalUrl: "https://example.com/", ogType: "article", rootPrefix: "../../", headerHtml: "", heading: "h", lead: "", pageKind: "article" };
  assert.match(renderStaticDocument({ ...base, bodyHtml: renderLoomCalculator("単位") }), /<script type="module" src="\.\.\/\.\.\/src\/loom-page\.js"><\/script>/);
  assert.doesNotMatch(renderStaticDocument({ ...base, bodyHtml: "<p>本文</p>" }), /<script/);
});

test("出星の時刻と地球の時刻は行き来できる", () => {
  const { system } = getDerleSystem();
  const params = { dayEarthSeconds: system.planet.secondsPerDay, yearLocalDays: system.planet.yearLocalDays };
  const date = new Date("2026-11-08T12:34:56Z");
  const back = localToEarth(earthToLocal(date, params), params);
  assert.ok(Math.abs(back.getTime() - date.getTime()) < 1, `${back.toISOString()}`);
});

test("数の表示", () => {
  assert.equal(formatNumber(6682.337, 6), "6,682.34");
  assert.equal(formatNumber(7.101e24, 4), "7.101×10²⁴");
  assert.equal(formatNumber(0.0001234, 3), "1.23×10⁻⁴");
  assert.equal(formatNumber(0.10424, 4), "0.1042");
});
