import test from "node:test";
import assert from "node:assert/strict";

import {
  computeSystem,
  computeStar,
  leapCycleCandidates,
  earthToLocal,
  celsiusToGal,
  galToCelsius,
  TALK_KG,
  derivedUnits,
} from "../src/lib/loom/index.js";
import { DERLE_INPUT } from "../src/lib/loom/derle.js";

// 相対誤差 tol 以内で一致すること
function near(actual, expected, tol, label) {
  const rel = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(rel <= tol, `${label}: ${actual} と ${expected} の差が ${(rel * 100).toFixed(4)} % (許容 ${(tol * 100).toFixed(4)} %)`);
}

// 較正: 世界織機 5.00 (2026-11-03 取得) の出星系の出力値と照らし合わせる。
// 定数の違い (下のコメント) によるずれは許容幅に含めている。
const result = computeSystem(DERLE_INPUT);

test("較正: 主星", () => {
  const s = result.star;
  near(s.luminosity, 1.287916503, 1e-9, "光度");
  near(s.radius, 1.0367, 1e-4, "半径");
  near(s.density, 0.956, 1e-3, "密度");
  near(s.lifetime, 8.271, 1e-3, "寿命");
  // 織機と同じ Kasting ほか 1993 の限界も出せる (既定は Kopparapu ほか 2014)
  near(s.habitableZoneKasting1993.inner, 1.082050454, 1e-9, "居住可能領域の内限 (Kasting 1993)");
  near(s.habitableZoneKasting1993.outer, 1.558855714, 1e-9, "居住可能領域の外限 (Kasting 1993)");
  // 織機は太陽の有効温度に 5776 K、ここは IAU 2015 の 5772 K を使うので 0.07 % 低くなる
  near(s.teff, 6043, 1e-3, "有効温度");
  // 型は Pecaut & Mamajek 2013 の表で補間する。織機の線形の割り振りでは F9.7V だった
  assert.equal(s.spectralClass, "F9.1V");
});

test("スペクトル型は表の型にそのまま戻る", async () => {
  const { spectralClass } = await import("../src/lib/loom/star.js");
  for (const [teff, type] of [
    [31400, "B0V"],
    [9700, "A0V"],
    [5770, "G2V"],
    [3850, "M0V"],
  ]) {
    assert.equal(spectralClass(teff), type);
  }
});

test("生命居住可能領域: 太陽で Kopparapu ほか 2014 の値になる", async () => {
  const { habitableZone } = await import("../src/lib/loom/star.js");
  const hz = habitableZone(1, 5780);
  near(hz.inner, Math.sqrt(1 / 1.107), 1e-12, "暴走温室効果");
  near(hz.outer, Math.sqrt(1 / 0.356), 1e-12, "最大温室効果");
});

test("較正: 惑星", () => {
  const p = result.planet;
  near(p.gravity, 1.080763624, 1e-8, "重力 (地球比)");
  near(p.escapeVelocityKms, 11.90975859, 1e-4, "脱出速度");
  // 織機は地球の密度 5.51 g/cm³、ここは 5.9722e24 kg と 6371 km から出す
  near(p.densityGcm3, 5.67749486, 1e-3, "密度");
  near(p.cmf, 0.32893, 1e-3, "コア質量比 (半径からの逆算)");
  // 軌道長半径は一年の長さから逆算する。織機の入力 1.225 AU とは恒星年の扱いの差だけずれる
  near(p.semiMajorAxis, 1.225, 1e-4, "軌道長半径");
  near(p.yearLocalDays, 404.4581279, 1e-9, "一年 (惑星日)");
  assert.equal(p.tropic, 19.505);
  near(p.polarCircle, 70.495, 1e-9, "極圏");
  // 温室効果の倍率は、この計算機のモデルで 281 K になるように derle.js で合わせてある
  near(p.surfaceTempK, 281, 1e-3, "地表平均温度");
  near(p.horizonKm, 4.836159738, 1e-6, "地平線までの距離");
});

test("較正: 衛星", () => {
  const m = result.moon;
  near(m.radiusKm, 1780.827786, 1e-6, "半径");
  // 織機は G = 6.67e-11、ここは CODATA 2018 の 6.6743e-11。周期は 0.03 % 短くなる
  near(m.siderealDays, 32.03685948, 5e-4, "恒星月 (地球日)");
  near(m.synodicDays, 34.32902445, 5e-4, "朔望月 (地球日)");
  near(m.synodicLocalDays, 28.93933356, 5e-4, "朔望月 (惑星日)");
  near(m.rocheLimitKm, 18402.27939, 1e-3, "ロッシュ限界");
  // 織機は 1 AU を 1.5e8 km、質量を丸めた値で計算しているので 0.3 % ずれる
  near(m.hillRadiusKm, 1906034.06, 5e-3, "ヒル半径");
  assert.equal(m.lockedToPlanet, true);
});

test("較正: 時間単位", () => {
  const u = result.time.units;
  assert.equal(u.secondsPerDay, 93312);
  near(u.second, 1.098371311, 1e-9, "1 秒");
  near(u.minute, 79.0827344, 1e-9, "1 分");
  near(u.hour, 2846.978438, 1e-9, "1 時");
});

test("閏年の候補は連分数の近似分数になる", () => {
  const c = leapCycleCandidates(404.4581279);
  assert.deepEqual(
    c.slice(0, 3).map(({ leaps, years }) => [leaps, years]),
    [
      [1, 2],
      [5, 11],
      [11, 24],
    ]
  );
});

test("地球の時刻と出星の時刻: 基準点で一致する", () => {
  const r = earthToLocal(new Date("2018-04-29T09:00:00Z"), {
    dayEarthSeconds: result.planet.secondsPerDay,
    yearLocalDays: result.planet.yearLocalDays,
  });
  assert.equal(r.year, 2551);
  assert.equal(r.dayOfYear, 9);
  assert.equal(r.hour, 3);
  assert.equal(r.minute, 26);
  assert.ok(Math.abs(r.second - 40) < 1e-6);
});

test("地球を入れると 288 K になる", async () => {
  const { surfaceTemperature } = await import("../src/lib/loom/planet.js");
  near(surfaceTemperature(1, 0.29, 1, 1), 288, 1e-12, "地球の地表平均温度");
});

test("太陽を入れると太陽の値に戻る", () => {
  const s = computeStar({ mass: 1, age: 4.6, relations: "classic" });
  assert.equal(s.luminosity, 1);
  assert.equal(s.radius, 1);
  assert.equal(s.teff, 5772);
  assert.equal(s.spectralClass, "G2V");
  // 観測に基づく Eker ほか 2018 の関係では、太陽はわずかに暗く小さく出る (経験式のばらつきの範囲)
  const e = computeStar({ mass: 1, age: 4.6 });
  near(e.luminosity, 0.984, 1e-3, "Eker 2018 の太陽の光度");
  near(e.radius, 0.992, 1e-9, "Eker 2018 の太陽の半径");
});

test("出度量衡", () => {
  near(galToCelsius(500), 356.7, 1e-12, "500 gal");
  near(celsiusToGal(0), 49.086, 1e-4, "0 ℃");
  near(TALK_KG * 1000, 1.4123, 1e-4, "1 talk");
  const d = derivedUnits(1.098371311);
  near(d.mos, 0.1042, 1e-3, "1 mos");
  near(d.tylostConstant, 8.437e23, 1e-3, "tylost 定数");
});
