// 主系列星の性質を質量から見積もる。
// 入力: 質量 [太陽質量]、年齢 [Gyr]。光度・半径は直接与えることもできる (設定で決めた値を優先するため)。
// 出力は太陽を 1 とした比と SI の値。

import { SUN, AU_M } from "./constants.js";

// ── 質量光度関係 ──────────────────────────────
// Eker ほか 2018 (MNRAS 479, 5491) 表 4: 食連星 509 個に当てはめた log L = a·log M + b の 6 区間。
const EKER2018_MLR = [
  [0.179, 0.45, 2.028, -0.976],
  [0.45, 0.72, 4.572, -0.102],
  [0.72, 1.05, 5.743, -0.007],
  [1.05, 2.4, 4.329, 0.01],
  [2.4, 7, 3.967, 0.093],
  [7, 31, 2.865, 1.105],
];

export const MASS_LUMINOSITY = {
  // 既定。観測 (食連星) に基づく。適用範囲 0.179〜31 M☉
  eker2018(mass) {
    const row = EKER2018_MLR.find(([lo, hi]) => mass >= lo && mass < hi) ?? (mass < 0.179 ? EKER2018_MLR[0] : EKER2018_MLR.at(-1));
    return 10 ** (row[2] * Math.log10(mass) + row[3]);
  },
  // 教科書の近似 (Duric 2004 などの区分べき乗則)。世界織機もこれを使う
  classic(mass) {
    if (mass < 0.43) return 0.23 * mass ** 2.3;
    if (mass < 2) return mass ** 4;
    if (mass < 55) return 1.4 * mass ** 3.5;
    return 32000 * mass;
  },
};

// ── 質量半径関係 ──────────────────────────────
// Eker ほか 2018 の質量有効温度関係 (1.5 M☉ より重い星の半径を出すのに使う)
export function ekerTeff(mass) {
  const x = Math.log10(mass);
  return 10 ** (-0.17 * x ** 2 + 0.888 * x + 3.671);
}

export const MASS_RADIUS = {
  // 既定。0.179〜1.5 M☉ は Eker ほか 2018 の二次式、それより重い星は Eker の光度と有効温度から求める
  eker2018(mass) {
    if (mass <= 1.5) return 0.438 * mass ** 2 + 0.479 * mass + 0.075;
    const L = MASS_LUMINOSITY.eker2018(mass);
    return Math.sqrt(L) * (SUN.teff / ekerTeff(mass)) ** 2;
  },
  // 教科書の近似 (R ∝ M^0.8、M^0.57。出典のはっきりしない経験則)。世界織機もこれを使う
  classic(mass) {
    return mass < 1 ? mass ** 0.8 : mass ** 0.57;
  },
};

// 主系列にいられる時間 [Gyr]。燃料 (質量) ÷ 消費率 (光度) を太陽の 10 Gyr で規格化したもの (Hansen & Kawaler 1994)。
export function mainSequenceLifetime(mass, luminosity) {
  return 10 * (mass / luminosity);
}

// 有効温度 [K]。シュテファン=ボルツマンの法則 L = 4πR²σT⁴ を太陽 (IAU 2015 の 5772 K) で規格化したもの。
export function effectiveTemperature(luminosity, radius) {
  return SUN.teff * (luminosity / radius ** 2) ** 0.25;
}

// ── スペクトル型 ──────────────────────────────
// Pecaut & Mamajek 2013 (ApJS 208, 9) の主系列星の表 (E. Mamajek, 2022.04.16 版) から、型と有効温度の組。
// 表の隣り合う型のあいだを有効温度で線形に補間する。
const DWARF_TEFF = `O3:44900 O4:42900 O5:41400 O5.5:40500 O6:39500 O6.5:38300 O7:37100 O7.5:36100 O8:35100 O8.5:34300
O9:33300 O9.5:31900 B0:31400 B0.5:29000 B1:26000 B1.5:24500 B2:20600 B2.5:18500 B3:17000 B4:16400 B5:15700
B6:14500 B7:14000 B8:12300 B9:10700 B9.5:10400 A0:9700 A1:9300 A2:8800 A3:8600 A4:8250 A5:8100 A6:7910 A7:7760
A8:7590 A9:7400 F0:7220 F1:7020 F2:6820 F3:6750 F4:6670 F5:6550 F6:6350 F7:6280 F8:6180 F9:6050 F9.5:5990
G0:5930 G1:5860 G2:5770 G3:5720 G4:5680 G5:5660 G6:5600 G7:5550 G8:5480 G9:5380 K0:5270 K1:5170 K2:5100 K3:4830
K4:4600 K5:4440 K6:4300 K7:4100 K8:3990 K9:3930 M0:3850 M0.5:3770 M1:3660 M1.5:3620 M2:3560 M2.5:3470 M3:3430
M3.5:3270 M4:3210 M4.5:3110 M5:3060 M5.5:2930 M6:2810 M6.5:2740 M7:2680 M7.5:2630 M8:2570 M8.5:2420 M9:2380 M9.5:2350`
  .split(/\s+/)
  .map((pair) => {
    const [type, teff] = pair.split(":");
    const letter = type[0];
    return { code: "OBAFGKM".indexOf(letter) * 10 + Number(type.slice(1)), teff: Number(teff) };
  });

export function spectralClass(teff) {
  if (teff > DWARF_TEFF[0].teff || teff < DWARF_TEFF.at(-1).teff) return null;
  for (let i = 0; i < DWARF_TEFF.length - 1; i += 1) {
    const hot = DWARF_TEFF[i];
    const cool = DWARF_TEFF[i + 1];
    if (teff <= hot.teff && teff >= cool.teff) {
      const code = hot.code + ((hot.teff - teff) / (hot.teff - cool.teff)) * (cool.code - hot.code);
      const rounded = Math.round(code * 10) / 10;
      const letter = "OBAFGKM"[Math.floor(rounded / 10)];
      return `${letter}${(rounded % 10).toFixed(1).replace(/\.0$/, "")}V`;
    }
  }
  return null;
}

// ── 生命居住可能領域 ──────────────────────────
// Kopparapu ほか 2014 (ApJL 787, L29) の係数 (著者公開の HZ_coefficients.dat)。
// S_eff = S☉ + a·T + b·T² + c·T³ + d·T⁴、T = Teff − 5780 K、距離 d = √(L / S_eff) AU。適用範囲 2600〜7200 K。
const KOPPARAPU2014 = {
  recentVenus: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
  runawayGreenhouse: [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15],
  maximumGreenhouse: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
  earlyMars: [0.32, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16],
};

export function kopparapuSeff(limit, teff) {
  const [s, a, b, c, d] = KOPPARAPU2014[limit];
  const t = teff - 5780;
  return s + a * t + b * t ** 2 + c * t ** 3 + d * t ** 4;
}

// 保守的な領域 = 暴走温室効果 〜 最大温室効果。楽観的な領域 = 最近の金星 〜 初期の火星。
export function habitableZone(luminosity, teff) {
  const at = (limit) => Math.sqrt(luminosity / kopparapuSeff(limit, teff));
  return {
    inner: at("runawayGreenhouse"),
    outer: at("maximumGreenhouse"),
    optimisticInner: at("recentVenus"),
    optimisticOuter: at("earlyMars"),
    validTeff: teff >= 2600 && teff <= 7200,
  };
}

// 参考: Kasting ほか 1993 (Icarus 101, 108) の保守的な限界 (水の喪失 S = 1.1、CO₂ の凝結開始 S = 0.53)。
// 世界織機はこれを使う。恒星の型による違いは入っていない。
export function habitableZoneKasting1993(luminosity) {
  return { inner: Math.sqrt(luminosity / 1.1), outer: Math.sqrt(luminosity / 0.53) };
}

// 雪線 [AU]。Hayashi 1981 の円盤温度 T = 280 K·(r / 1 AU)^(−1/2)·L^(1/4) が氷の凝結温度になる距離。
// 凝結温度 170 K で 2.7·√L AU。
export function snowLine(luminosity, iceTemperatureK = 170) {
  return (280 / iceTemperatureK) ** 2 * Math.sqrt(luminosity);
}

export function computeStar({ mass, age, luminosity: givenL, radius: givenR, relations = "eker2018" }) {
  const luminosity = givenL ?? MASS_LUMINOSITY[relations](mass);
  const radius = givenR ?? MASS_RADIUS[relations](mass);
  const teff = effectiveTemperature(luminosity, radius);
  const hz = habitableZone(luminosity, teff);
  return {
    mass,
    massKg: mass * SUN.mass,
    age,
    luminosity,
    luminosityW: luminosity * SUN.luminosity,
    radius,
    radiusKm: (radius * SUN.radius) / 1000,
    density: mass / radius ** 3,
    densityGcm3: (mass / radius ** 3) * SUN.density,
    teff,
    spectralClass: spectralClass(teff),
    lifetime: mainSequenceLifetime(mass, luminosity),
    habitableZone: hz,
    habitableZoneKasting1993: habitableZoneKasting1993(luminosity),
    snowLine: snowLine(luminosity),
    habitableZoneKm: { inner: (hz.inner * AU_M) / 1000, outer: (hz.outer * AU_M) / 1000 },
  };
}
