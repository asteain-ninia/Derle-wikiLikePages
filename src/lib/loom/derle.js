// 出星系の入力値 (正本の候補)。計算で出す値はここに書かない。
//
// 値の多くは「地球 (月・太陽) の値 × サイコロで決めた倍率」で決めている。
// 倍率 (DICE) と掛け元 (REFERENCE) を別々に残し、掛け算は下で行う。振り直すときは DICE だけ変える。
// 掛け元は世界織機 5.00 が使っていた値で、最新の測定値と少し違っても、そのまま使う。
// 出所: 世界織機 5.00 (2026-11-03 取得) の入力セルと、H 列の倍率。

// 掛け元 (世界織機の基準値)
export const REFERENCE = {
  earthCmf: 0.35, // 地球のコア質量比
  earthObliquity: 23.5, // °
  earthDayHours: 24,
  earthAlbedo: 0.29,
  earthEccentricity: 0.0167,
  earthO2: 20.95, // %
  earthCO2: 0.04, // %
  earthAr: 0.93, // %
  moonDensity: 3.34, // g/cm³ (倍率どうしの比として使う)
  moonAlbedo: 0.136,
  moonSemiMajorAxisKm: 384748,
  moonEccentricity: 0.055,
  moonInclination: 5.15, // °
};

// サイコロで決めた倍率
export const DICE = {
  planetCmf: 0.9398,
  planetObliquity: 0.83,
  planetDay: 1.186241016,
  planetAlbedo: 1.012,
  planetEccentricity: 0.9349,
  planetO2: 0.9936,
  planetCO2: 1.0,
  planetAr: 1.1341,
  moonDensity: 1.1824,
  moonAlbedo: 0.9448,
  moonSemiMajorAxis: 1.1781,
  moonEccentricity: 1.0152,
  moonInclination: 0.812,
};

const R = REFERENCE;
const D = DICE;
const o2 = D.planetO2 * R.earthO2;
const co2 = D.planetCO2 * R.earthCO2;
const ar = D.planetAr * R.earthAr;

export const DERLE_INPUT = {
  star: {
    mass: 1.0653, // 太陽質量
    age: 4.5, // Gyr
    // 光度と半径は織機の教科書的近似 (L = M⁴、R = M^0.57) で決まった値を、設定として固定する。
    // 観測に基づく Eker ほか 2018 の関係で出し直すと L ≒ 1.35、R ≒ 1.08、有効温度 ≒ 5,975 K (F9.6V) になる
    luminosity: 1.287916503,
    radius: 1.036714084,
  },
  planet: {
    mass: 1.189, // 地球質量
    cmf: D.planetCmf * R.earthCmf, // コア質量比 → 半径は Zeng ほか 2016 の式で出す
    obliquity: D.planetObliquity * R.earthObliquity,
    dayHours: D.planetDay * R.earthDayHours, // 一日の長さ (固定)
    // 一年の長さ (固定)。織機で軌道長半径 1.225 AU から出した値 (= 404.4581279 惑星日)。軌道長半径はここから逆算する
    yearEarthDays: 479.7848206,
    eccentricity: D.planetEccentricity * R.earthEccentricity,
    inclination: 0.0844, // °
    albedo: D.planetAlbedo * R.earthAlbedo,
    // 地表平均温度と気圧は仮の値。気候推定の結果で差し替える。温室効果の倍率は温度から逆算する
    surfaceTempK: 281,
    atmosphere: {
      pressureAtm: 1.0208,
      composition: { O2: o2, CO2: co2, Ar: ar, N2: 100 - o2 - co2 - ar },
    },
  },
  moon: {
    mass: 1.2733, // 月質量
    densityRatio: D.moonDensity, // 月比の密度 → 半径を出す
    semiMajorAxisKm: D.moonSemiMajorAxis * R.moonSemiMajorAxisKm,
    eccentricity: D.moonEccentricity * R.moonEccentricity,
    inclination: D.moonInclination * R.moonInclination,
    albedo: D.moonAlbedo * R.moonAlbedo,
  },
};
