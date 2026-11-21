// 衛星の物理・軌道の性質と、潮汐固定の見積もり。
// 質量は月を 1 とした比、軌道長半径は km で受け取る。

import { G, EARTH, MOON, SUN, AU_M, SECONDS_PER_DAY, SECONDS_PER_YEAR } from "./constants.js";

// 流体のロッシュ限界 [m]。d = 2.44·R_p·(ρ_p / ρ_m)^(1/3)。これより内側では衛星が潮汐で壊れる。
export function rocheLimit(planetRadiusM, planetDensity, moonDensity) {
  return 2.44 * planetRadiusM * (planetDensity / moonDensity) ** (1 / 3);
}

// ヒル球の半径 [m]。r_H = a·(m / 3M)^(1/3)。衛星が安定して回れるのは、順行でおよそ r_H の半分まで。
export function hillRadius(semiMajorAxisM, bodyMassKg, primaryMassKg) {
  return semiMajorAxisM * (bodyMassKg / (3 * primaryMassKg)) ** (1 / 3);
}

// 二体問題のケプラーの第三法則 [s]。P = 2π √(a³ / G(M + m))。
export function keplerPeriod(semiMajorAxisM, totalMassKg) {
  return 2 * Math.PI * Math.sqrt(semiMajorAxisM ** 3 / (G * totalMassKg));
}

// 会合周期 (朔望月)。順行どうしなら 1 / |1/P₁ − 1/P₂|。
export function synodicPeriod(p1, p2) {
  return 1 / Math.abs(1 / p1 - 1 / p2);
}

// 均質な弾性球の潮汐ラブ数 k₂ = (3/2) / (1 + 19μ / (2ρgR))。
export function loveNumber(rigidityPa, densityKgM3, gravityMs2, radiusM) {
  return 1.5 / (1 + (19 * rigidityPa) / (2 * densityKgM3 * gravityMs2 * radiusM));
}

// 潮汐固定にかかる時間 [s] (自転が公転と同期するまで)。
// t = ω·a⁶·I·Q / (3·G·M_p²·k₂·R⁵)。
// ω: 初めの自転角速度、a: 軌道長半径、I: 慣性モーメント、Q: 潮汐散逸の品質係数、
// M_p: 潮汐を起こす側の質量、k₂・R: 固定される側のラブ数と半径。
export function tidalLockingTime({ spinRateRadS, semiMajorAxisM, momentOfInertia, q, perturberMassKg, k2, radiusM }) {
  return (spinRateRadS * semiMajorAxisM ** 6 * momentOfInertia * q) / (3 * G * perturberMassKg ** 2 * k2 * radiusM ** 5);
}

// 潮汐固定の計算で使う既定値。
export const TIDAL_DEFAULTS = {
  rigidityPa: 3e10, // 岩石の剛性率 (Gladman ほか 1996)
  qPlanet: 12, // 地球 12 ± 2 (Williams ほか 1978、月レーザー測距)
  qMoon: 37, // 月の月周期 Q = 37 (+6/−4) (Williams ほか 2001)
  inertiaFactor: 0.4, // 均質な球 I = 0.4·M·R²
  moonInitialSpinHours: 12,
};

// 潮汐の強さ (単位質量あたりの潮汐加速度の大きさ 2GMr / d³)
export function tidalAcceleration(perturberMassKg, radiusM, distanceM) {
  return (2 * G * perturberMassKg * radiusM) / distanceM ** 3;
}

export function computeMoon(input, planet, star, opts = TIDAL_DEFAULTS) {
  const { mass, semiMajorAxisKm, eccentricity, inclination = 0 } = input;
  const massKg = mass * MOON.mass;
  // 半径は radius (月比) か、densityRatio (月比の密度) から求める。密度の絶対値は density [g/cm³] でも渡せる
  const radius = input.radius ?? Math.cbrt(mass / (input.densityRatio ?? (input.density ?? MOON.density) / MOON.density));
  const density = input.density ?? (mass / radius ** 3) * MOON.density;
  const radiusM = radius * MOON.radius;
  const gravityMs2 = (G * massKg) / radiusM ** 2;
  const aM = semiMajorAxisKm * 1000;

  const siderealS = keplerPeriod(aM, planet.massKg + massKg);
  const siderealDays = siderealS / SECONDS_PER_DAY;
  const synodicDays = synodicPeriod(siderealDays, planet.yearEarthDays);

  const planetRadiusM = planet.radiusKm * 1000;
  const planetDensityKg = planet.densityGcm3 * 1000;
  const starMassKg = star.mass * SUN.mass;
  const planetAM = planet.semiMajorAxis * AU_M;

  // 潮汐固定
  const moonK2 = loveNumber(opts.rigidityPa, density * 1000, gravityMs2, radiusM);
  const planetK2 = loveNumber(opts.rigidityPa, planetDensityKg, planet.gravityMs2, planetRadiusM);
  const moonLockS = tidalLockingTime({
    spinRateRadS: (2 * Math.PI) / (opts.moonInitialSpinHours * 3600),
    semiMajorAxisM: aM,
    momentOfInertia: opts.inertiaFactor * massKg * radiusM ** 2,
    q: opts.qMoon,
    perturberMassKg: planet.massKg,
    k2: moonK2,
    radiusM,
  });
  const planetSpin = (2 * Math.PI) / (planet.dayHours * 3600);
  const planetInertia = opts.inertiaFactor * planet.massKg * planetRadiusM ** 2;
  const planetToMoonS = tidalLockingTime({
    spinRateRadS: planetSpin,
    semiMajorAxisM: aM,
    momentOfInertia: planetInertia,
    q: opts.qPlanet,
    perturberMassKg: massKg,
    k2: planetK2,
    radiusM: planetRadiusM,
  });
  const planetToStarS = tidalLockingTime({
    spinRateRadS: planetSpin,
    semiMajorAxisM: planetAM,
    momentOfInertia: planetInertia,
    q: opts.qPlanet,
    perturberMassKg: starMassKg,
    k2: planetK2,
    radiusM: planetRadiusM,
  });
  const gyr = (s) => s / SECONDS_PER_YEAR / 1e9;

  // 潮汐の強さ (地球が月と太陽から受ける合計を 1 とする)
  const tideMoon = tidalAcceleration(massKg, planetRadiusM, aM);
  const tideStar = tidalAcceleration(starMassKg, planetRadiusM, planetAM);
  const earthTide =
    tidalAcceleration(MOON.mass, EARTH.radius, MOON.semiMajorAxis) + tidalAcceleration(SUN.mass, EARTH.radius, AU_M);

  return {
    mass,
    massKg,
    density,
    radius,
    radiusKm: radiusM / 1000,
    gravityMs2,
    gravity: gravityMs2 / ((G * MOON.mass) / MOON.radius ** 2),
    escapeVelocityKms: Math.sqrt((2 * G * massKg) / radiusM) / 1000,
    semiMajorAxisKm,
    eccentricity,
    periapsisKm: semiMajorAxisKm * (1 - eccentricity),
    apoapsisKm: semiMajorAxisKm * (1 + eccentricity),
    inclination,
    rocheLimitKm: rocheLimit(planetRadiusM, planet.densityGcm3, density) / 1000,
    hillRadiusKm: hillRadius(planetAM, planet.massKg, starMassKg) / 1000,
    siderealDays,
    siderealLocalDays: siderealDays / planet.dayEarthDays,
    synodicDays,
    synodicLocalDays: synodicDays / planet.dayEarthDays,
    monthsPerYear: planet.yearEarthDays / synodicDays,
    lockingGyr: { moonToPlanet: gyr(moonLockS), planetToMoon: gyr(planetToMoonS), planetToStar: gyr(planetToStarS) },
    lockedToPlanet: gyr(moonLockS) <= star.age,
    tides: {
      total: (tideMoon + tideStar) / earthTide,
      moonShare: tideMoon / (tideMoon + tideStar),
      starShare: tideStar / (tideMoon + tideStar),
    },
  };
}
