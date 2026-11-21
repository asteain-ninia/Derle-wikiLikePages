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
  assert.match(expandLoomTemplates("{{織機|惑星の半径|kg}}"), /「長さ」に単位「kg」はありません/);
});

test("組み込みの名前 (constructor など) でもビルドが止まらない", () => {
  for (const name of ["constructor", "toString", "__proto__"]) {
    assert.match(expandLoomTemplates(`{{織機|${name}|km}}`), /〔織機: 量「.+」はありません〕/);
    assert.match(expandLoomTemplates(`{{織機|惑星の半径|${name}}}`), /単位「.+」はありません/);
    assert.match(renderLoomCalculator(name), /計算機「.+」はありません/);
  }
});

test("有効数字の欄の前後の空白は無視する", () => {
  assert.equal(expandLoomTemplates("{{織機|惑星の半径|km| 6 }}"), "6,682.34");
});

test("行に単独でない {{計算機}} は印になり、内部の印が本文に漏れない", () => {
  for (const src of ["* {{計算機|単位}}", "前の文 {{計算機|単位}} 後の文"]) {
    const expanded = expandLoomTemplates(src);
    assert.ok(!expanded.includes("\x00"), JSON.stringify(expanded));
    assert.match(expanded, /〔計算機「単位」は行に単独で書く〕/);
  }
  assert.ok(expandLoomTemplates("  {{計算機|単位}}  ").includes("\x00CALC:単位\x00"));
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
  assert.match(renderLoomCalculator("時刻"), /シェル暦 2551 年 1 月 9 日 \(週の 2 日目\) 3 時 26 分 40 秒/);
  assert.match(renderLoomCalculator("ない"), /計算機「ない」はありません/);
});

test("静的ページは計算機があるときだけスクリプトを読む", () => {
  const base = { siteName: "s", documentTitle: "t", title: "t", description: "", canonicalUrl: "https://example.com/", ogType: "article", rootPrefix: "../../", headerHtml: "", heading: "h", lead: "", pageKind: "article" };
  assert.match(renderStaticDocument({ ...base, bodyHtml: renderLoomCalculator("単位") }), /<script type="module" src="\.\.\/\.\.\/src\/loom-page\.js"><\/script>/);
  assert.doesNotMatch(renderStaticDocument({ ...base, bodyHtml: "<p>本文</p>" }), /<script/);
});

test("出星の時刻と地球の時刻は行き来できる", () => {
  const { system } = getDerleSystem();
  const params = { dayEarthSeconds: system.planet.secondsPerDay };
  for (const iso of ["2026-11-08T12:34:56Z", "1900-01-01T00:00:00Z", "2300-06-15T18:00:00Z"]) {
    const date = new Date(iso);
    const back = localToEarth(earthToLocal(date, params), params);
    assert.ok(Math.abs(back.getTime() - date.getTime()) < 1, `${iso} → ${back.toISOString()}`);
  }
});

test("シェル暦: 年の境目・月なしの日・月を抜く年", async () => {
  const cal = await import("../src/lib/loom/calendar.js");
  const { system } = getDerleSystem();
  const params = { dayEarthSeconds: system.planet.secondsPerDay };
  const at = (local) => cal.earthToLocal(cal.localToEarth({ hour: 0, minute: 0, second: 0, ...local }, params), params);

  // 年の 1 日目 0 時は、前の年の最後の日にならない (レビュー指摘 1)
  const newYear = at({ year: 2552, month: 1, day: 1 });
  assert.deepEqual([newYear.year, newYear.month, newYear.day, newYear.hour, newYear.minute], [2552, 1, 1, 0, 0]);

  // 月なしの日は月にも週にも属さない
  const monthless = at({ year: 2551, month: 3, monthless: true });
  assert.deepEqual([monthless.month, monthless.day, monthless.monthless, monthless.weekday], [3, null, true, null]);
  const next = at({ year: 2551, month: 4, day: 1 });
  assert.equal(next.dayOfYear, monthless.dayOfYear + 1);

  // 平年 405 日、月を抜く年 376 日。2596 は月を抜く年 (2596 ÷ 53 の余りが 52)
  assert.equal(cal.yearLength(2551), 405);
  assert.equal(cal.isShortYear(2596), true);
  assert.equal(cal.yearLength(2596), 376);
  assert.throws(() => cal.localToEarth({ year: 2596, month: 14, day: 1, hour: 0, minute: 0, second: 0 }, params), RangeError);
  // 年の変わり目には月なしの日がない
  assert.throws(() => cal.localToEarth({ year: 2551, month: 14, monthless: true, hour: 0, minute: 0, second: 0 }, params), RangeError);

  // 53 年でちょうど 21,436 日
  let days = 0;
  for (let y = 2544; y < 2597; y += 1) days += cal.yearLength(y);
  assert.equal(days, 21436);
});

test("数の表示", () => {
  assert.equal(formatNumber(6682.337, 6), "6,682.34");
  assert.equal(formatNumber(7.101e24, 4), "7.101×10²⁴");
  assert.equal(formatNumber(0.0001234, 3), "1.23×10⁻⁴");
  assert.equal(formatNumber(0.10424, 4), "0.1042");
  // 丸めで桁が繰り上がっても有効数字は増えない
  assert.equal(formatNumber(9.9996, 4), "10.00");
  assert.equal(formatNumber(999.96, 4), "1,000");
});

test("おかしな入力には警告が付く", async () => {
  const { computeSystem } = await import("../src/lib/loom/index.js");
  const { DERLE_INPUT } = await import("../src/lib/loom/derle.js");
  const cold = computeSystem({ ...DERLE_INPUT, planet: { ...DERLE_INPUT.planet, surfaceTempK: 200 } });
  assert.match(cold.planet.warnings.join(), /温室効果がマイナス/);
  assert.deepEqual(computeSystem(DERLE_INPUT).planet.warnings, []);
  assert.throws(() => computeSystem({ ...DERLE_INPUT, planet: { ...DERLE_INPUT.planet, obliquity: -10 } }), RangeError);
});
