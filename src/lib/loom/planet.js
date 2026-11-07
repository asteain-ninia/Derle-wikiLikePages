// 岩石惑星の物理・軌道・大気の性質。
// 長さ・質量は地球を 1 とした比で受け取り、SI の値も併せて返す。

import { G, SIGMA, R_GAS, AU_M, SUN, EARTH, SECONDS_PER_DAY } from "./constants.js";

const EARTH_GM = G * EARTH.mass;
const EARTH_SURFACE_GRAVITY = EARTH_GM / EARTH.radius ** 2; // 自転の遠心力を含まない万有引力だけの値 ≒ 9.820 m/s²

// 岩石惑星の質量半径関係 (コア質量比 CMF つき)。R = (1.07 − 0.21·CMF)·M^(1/3.7)。
// 地球 (CMF ≒ 0.325) で R ≒ 1 になる。適用範囲はおおむね 1〜8 M⊕ (Zeng ほか 2016)。
export function radiusFromMassAndCmf(mass, cmf) {
  return (1.07 - 0.21 * cmf) * mass ** (1 / 3.7);
}

// 上の関係を逆に解き、質量と半径から CMF を推定する。
export function cmfFromMassAndRadius(mass, radius) {
  return (1.07 - radius / mass ** (1 / 3.7)) / 0.21;
}

// 回帰線と極圏の緯度 [°]。地軸の傾き ε が 90° を超える (逆行自転) ときは 180° − ε で考える。
export function climateLatitudes(obliquity) {
  const eps = obliquity <= 90 ? obliquity : 180 - obliquity;
  return { tropic: eps, polarCircle: 90 - eps };
}

// ケプラーの第三法則。P [恒星年] = √(a³ / M)、a は AU、M は太陽質量 (惑星の質量は無視)。
export function orbitalPeriodYears(semiMajorAxis, starMass) {
  return Math.sqrt(semiMajorAxis ** 3 / starMass);
}

// 一年の長さから軌道長半径を逆算する。「一年と一日の長さは固定し、軌道の方を合わせる」方針のため。
export function semiMajorAxisFromPeriod(periodEarthDays, starMass) {
  const years = periodEarthDays / EARTH.siderealYearDays;
  return Math.cbrt(starMass * years ** 2);
}

// 灰色大気モデルによる地表平均温度 [K]。
// 放射平衡温度 Teq⁴ = (1 − A)·L / (16πσd²)。
// 地表 Ts⁴ = Teq⁴·(1 + 3τ/4) / ε。τ は赤外の光学的厚さ、ε は地表の射出率 (既定は 1)。
// 地球の τ は、地球 (ボンド・アルベド 0.29、1 AU、太陽) で Ts = 288 K になるように逆算する。
// 「温室効果の強さ」greenhouse は、この地球の τ に掛ける倍率。
export function equilibriumTemperature(luminositySolar, albedo, distanceAu) {
  const L = luminositySolar * SUN.luminosity;
  const d = distanceAu * AU_M;
  return (((1 - albedo) * L) / (16 * Math.PI * SIGMA * d ** 2)) ** 0.25;
}

const EARTH_BOND_ALBEDO = 0.29;
const EARTH_TAU = (4 / 3) * ((EARTH.surfaceTemperature / equilibriumTemperature(1, EARTH_BOND_ALBEDO, 1)) ** 4 - 1);
export const GREENHOUSE_DEFAULTS = { tauEarth: EARTH_TAU, emissivity: 1 }; // τ⊕ ≒ 0.8195

export function surfaceTemperature(luminositySolar, albedo, distanceAu, greenhouse = 1, opts = GREENHOUSE_DEFAULTS) {
  const teq = equilibriumTemperature(luminositySolar, albedo, distanceAu);
  const tau = opts.tauEarth * greenhouse;
  return ((teq ** 4 * (1 + (3 * tau) / 4)) / opts.emissivity) ** 0.25;
}

// 地表温度を決めたときに、それを実現する温室効果の倍率 (地球の τ に掛ける値) を逆算する
export function greenhouseForTemperature(targetK, luminositySolar, albedo, distanceAu, opts = GREENHOUSE_DEFAULTS) {
  const teq = equilibriumTemperature(luminositySolar, albedo, distanceAu);
  const tau = (4 / 3) * ((opts.emissivity * targetK ** 4) / teq ** 4 - 1);
  return tau / opts.tauEarth;
}

// 惑星が受ける主星の光 (地球が太陽から受ける量 = 1)
export function insolation(luminositySolar, distanceAu) {
  return luminositySolar / distanceAu ** 2;
}

// 地平線までの距離 [m]。半径 R の球の上、高さ h から見た接線の長さ √(2Rh + h²)。
export function horizonDistance(radiusM, heightM) {
  return Math.sqrt(2 * radiusM * heightM + heightM ** 2);
}

// 大気の平均モル質量 [kg/mol] と地表の空気の密度 [kg/m³] (理想気体)
export const MOLAR_MASS = { N2: 0.028014, O2: 0.031998, Ar: 0.039948, CO2: 0.04401 };

export function meanMolarMass(composition) {
  let total = 0;
  let mass = 0;
  for (const [gas, percent] of Object.entries(composition)) {
    if (!(gas in MOLAR_MASS)) throw new Error(`未知の気体: ${gas}`);
    total += percent;
    mass += percent * MOLAR_MASS[gas];
  }
  return mass / total;
}

export function airDensity(pressurePa, molarMass, temperatureK) {
  return (pressurePa * molarMass) / (R_GAS * temperatureK);
}

// 惑星をまとめて計算する。
// 半径は radius (地球比) を直接与えるか、cmf (0〜1) から求める。
// 軌道は semiMajorAxis [AU] を与えるか、yearEarthDays (一年の長さ) から逆算する。
// 地表温度は surfaceTempK を与えると温室効果の倍率を逆算し、与えなければ greenhouse (倍率) から計算する。
export function computePlanet(input, star) {
  const { mass, obliquity, dayHours, albedo, eccentricity, inclination = 0 } = input;

  const radius = input.radius ?? radiusFromMassAndCmf(mass, input.cmf);
  const cmf = input.cmf ?? cmfFromMassAndRadius(mass, radius);
  const massKg = mass * EARTH.mass;
  const radiusM = radius * EARTH.radius;
  const gravityMs2 = (G * massKg) / radiusM ** 2;
  const escapeVelocityKms = Math.sqrt((2 * G * massKg) / radiusM) / 1000;

  const semiMajorAxis = input.semiMajorAxis ?? semiMajorAxisFromPeriod(input.yearEarthDays, star.mass);
  const periodYears = orbitalPeriodYears(semiMajorAxis, star.mass);
  const yearEarthDays = input.yearEarthDays ?? periodYears * EARTH.siderealYearDays;
  const dayEarthDays = dayHours / 24;

  const greenhouse =
    input.surfaceTempK !== undefined
      ? greenhouseForTemperature(input.surfaceTempK, star.luminosity, albedo, semiMajorAxis)
      : input.greenhouse ?? 1;
  const surfaceTempK = surfaceTemperature(star.luminosity, albedo, semiMajorAxis, greenhouse);

  const result = {
    mass,
    massKg,
    radius,
    radiusKm: radiusM / 1000,
    cmf,
    density: mass / radius ** 3,
    densityGcm3: (massKg / ((4 / 3) * Math.PI * radiusM ** 3)) / 1000,
    gravity: gravityMs2 / EARTH_SURFACE_GRAVITY,
    gravityMs2,
    escapeVelocity: escapeVelocityKms / EARTH.escapeVelocity,
    escapeVelocityKms,
    obliquity,
    rotation: obliquity === 90 ? "undefined" : obliquity < 90 ? "prograde" : "retrograde",
    ...climateLatitudes(obliquity),
    dayHours,
    semiMajorAxis,
    semiMajorAxisKm: (semiMajorAxis * AU_M) / 1000,
    eccentricity,
    periapsis: semiMajorAxis * (1 - eccentricity),
    apoapsis: semiMajorAxis * (1 + eccentricity),
    inclination,
    yearEarthDays,
    yearEarthYears: yearEarthDays / EARTH.siderealYearDays,
    yearLocalDays: yearEarthDays / dayEarthDays,
    insolation: insolation(star.luminosity, semiMajorAxis),
    equilibriumTempK: equilibriumTemperature(star.luminosity, albedo, semiMajorAxis),
    albedo,
    greenhouse,
    surfaceTempK,
    horizonKm: horizonDistance(radiusM, input.observerHeight ?? 1.75) / 1000,
    secondsPerDay: dayHours * 3600,
    dayEarthDays,
    yearSeconds: yearEarthDays * SECONDS_PER_DAY,
  };

  if (input.atmosphere) {
    const { pressureAtm, composition } = input.atmosphere;
    const pressurePa = pressureAtm * 101_325;
    const molarMass = meanMolarMass(composition);
    result.atmosphere = {
      pressureAtm,
      pressurePa,
      molarMass,
      airDensity: airDensity(pressurePa, molarMass, surfaceTempK),
      partialPressureAtm: Object.fromEntries(
        Object.entries(composition).map(([gas, percent]) => [gas, (pressureAtm * percent) / 100])
      ),
    };
  }

  return result;
}
