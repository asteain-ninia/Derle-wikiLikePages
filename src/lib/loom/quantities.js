// 記事から名前で引ける量と、その単位。
// 記事の {{織機|量|単位|有効数字}} と、計算機の単位換算の両方がここを使う。
// 値はすべて SI (温度は K) で持ち、単位で割って表示する。

import { AU_M, EARTH, G, MOON, SUN } from "./constants.js";
import { LENGTH_UNITS, TALK_KG, derivedUnits, kelvinToGal, galToCelsius } from "./units.js";

// 単位: factor は SI に掛ける倍率の逆 (SI 値 ÷ factor = その単位での値)。温度だけは変換関数を持つ。
export function buildUnits(system) {
  const t = system.time.units; // 出星の秒・分・時・日 (地球秒)
  const year = system.planet.yearSeconds;
  const derived = derivedUnits(t.second);
  return {
    長さ: {
      m: 1,
      km: 1000,
      AU: AU_M,
      地球半径: EARTH.radius,
      Qarli: LENGTH_UNITS.Qarli,
      firqil: LENGTH_UNITS.firqil,
      lamqil: LENGTH_UNITS.lamqil,
      Zamqil: LENGTH_UNITS.Zamqil,
      pasqil: LENGTH_UNITS.pasqil,
    },
    質量: {
      kg: 1,
      g: 1e-3,
      talk: TALK_KG,
      地球質量: EARTH.mass,
      月質量: MOON.mass,
      太陽質量: SUN.mass,
    },
    温度: {
      K: { from: (k) => k, to: (v) => v },
      "℃": { from: (k) => k - 273.15, to: (v) => v + 273.15 },
      gal: { from: kelvinToGal, to: (v) => galToCelsius(v) + 273.15 },
    },
    圧力: {
      Pa: 1,
      kPa: 1000,
      atm: 101_325,
      mos: derived.mos,
    },
    加速度: {
      "m/s²": 1,
      // 地球の重力 = GM⊕/R⊕² ≒ 9.820 m/s² (惑星の「重力の地球比」と同じ基準)。
      // 標準重力 g₀ = 9.80665 m/s² は自転の遠心力などを含めた慣用値で、別の単位にする
      地球の重力: (G * EARTH.mass) / EARTH.radius ** 2,
      標準重力: EARTH.gravity,
      "Qarli/秒²": derived.accelerationQarli,
      "firqil/秒²": derived.accelerationQarli * 100,
    },
    密度: {
      "g/cm³": 1000,
      "kg/m³": 1,
      "talk/Qarli³": TALK_KG / LENGTH_UNITS.Qarli ** 3,
    },
    時間: {
      地球秒: 1,
      地球分: 60,
      地球時間: 3600,
      地球日: 86_400,
      地球年: EARTH.siderealYearDays * 86_400,
      秒: t.second,
      分: t.minute,
      時: t.hour,
      日: t.day,
      年: year,
    },
    仕事率: {
      W: 1,
      太陽光度: SUN.luminosity,
    },
    速さ: {
      "m/s": 1,
      "km/s": 1000,
      "Qarli/秒": LENGTH_UNITS.Qarli / t.second,
    },
    角度: { "°": 1 },
    比: { "": 1 },
  };
}

// 名前で引ける量。get はシステムの計算結果から SI の値を返す
export const QUANTITIES = {
  主星の質量: ["質量", (s) => s.star.massKg],
  主星の半径: ["長さ", (s) => s.star.radiusKm * 1000],
  主星の光度: ["仕事率", (s) => s.star.luminosityW],
  主星の密度: ["密度", (s) => s.star.densityGcm3 * 1000],
  主星の有効温度: ["温度", (s) => s.star.teff],
  主星の寿命: ["時間", (s) => s.star.lifetime * 1e9 * EARTH.siderealYearDays * 86_400],
  惑星の質量: ["質量", (s) => s.planet.massKg],
  惑星の半径: ["長さ", (s) => s.planet.radiusKm * 1000],
  惑星の密度: ["密度", (s) => s.planet.densityGcm3 * 1000],
  表面重力: ["加速度", (s) => s.planet.gravityMs2],
  脱出速度: ["速さ", (s) => s.planet.escapeVelocityKms * 1000],
  地軸の傾き: ["角度", (s) => s.planet.obliquity],
  回帰線: ["角度", (s) => s.planet.tropic],
  極圏: ["角度", (s) => s.planet.polarCircle],
  一日: ["時間", (s) => s.planet.secondsPerDay],
  一年: ["時間", (s) => s.planet.yearSeconds],
  軌道長半径: ["長さ", (s) => s.planet.semiMajorAxis * AU_M],
  近日点距離: ["長さ", (s) => s.planet.periapsis * AU_M],
  遠日点距離: ["長さ", (s) => s.planet.apoapsis * AU_M],
  軌道離心率: ["比", (s) => s.planet.eccentricity],
  受ける光: ["比", (s) => s.planet.insolation],
  地表平均温度: ["温度", (s) => s.planet.surfaceTempK],
  地表の気圧: ["圧力", (s) => s.planet.atmosphere?.pressurePa],
  衛星の質量: ["質量", (s) => s.moon.massKg],
  衛星の半径: ["長さ", (s) => s.moon.radiusKm * 1000],
  衛星の軌道長半径: ["長さ", (s) => s.moon.semiMajorAxisKm * 1000],
  恒星月: ["時間", (s) => s.moon.siderealDays * 86_400],
  朔望月: ["時間", (s) => s.moon.synodicDays * 86_400],
};

// SI の値を、指定の単位での値に直す
export function convertFromSi(units, dimension, value, unit) {
  const table = units[dimension];
  if (!table || !(unit in table)) throw new Error(`「${dimension}」に単位「${unit}」はありません`);
  const u = table[unit];
  return typeof u === "object" ? u.from(value) : value / u;
}

export function convertToSi(units, dimension, value, unit) {
  const table = units[dimension];
  if (!table || !(unit in table)) throw new Error(`「${dimension}」に単位「${unit}」はありません`);
  const u = table[unit];
  return typeof u === "object" ? u.to(value) : value * u;
}

const SUPERSCRIPT = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };

// 有効数字 sig 桁で表示する。10⁶ 以上と 10⁻³ 未満は「×10ⁿ」、それ以外は 3 桁ごとにカンマ
export function formatNumber(value, sig = 4) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-3) {
    const [mantissa, exponent] = value.toExponential(sig - 1).split("e");
    const exp = String(Number(exponent)).replace(/./g, (ch) => SUPERSCRIPT[ch]);
    return `${mantissa}×10${exp}`;
  }
  const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
  const fixed = value.toFixed(digits);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fracPart ? `${grouped}.${fracPart}` : grouped;
}

// 記事の {{織機|量|単位|有効数字}} 1 個ぶんを文字列にする。読めないときは目に見える印を返す
export function formatQuantity(system, units, name, unit = "", sig = 4) {
  const entry = QUANTITIES[name];
  if (!entry) return `〔織機: 量「${name}」はありません〕`;
  const [dimension, get] = entry;
  const si = get(system);
  if (si === undefined) return `〔織機: 「${name}」は計算されていません〕`;
  const defaultUnit = Object.keys(units[dimension])[0];
  try {
    return formatNumber(convertFromSi(units, dimension, si, unit || defaultUnit), sig);
  } catch (error) {
    return `〔織機: ${error.message}〕`;
  }
}
