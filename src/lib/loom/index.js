// 出界の織機: 入力 (自分で決める値) から、恒星・惑星・衛星・時間の値をまとめて計算する。

import { computeStar } from "./star.js";
import { computePlanet } from "./planet.js";
import { computeMoon } from "./moon.js";
import { leapCycleCandidates, timeUnits, DEFAULT_DIVISIONS } from "./calendar.js";

export function computeSystem(input) {
  const star = computeStar(input.star);
  const planet = computePlanet(input.planet, star);
  const moon = input.moon ? computeMoon(input.moon, planet, star) : null;
  const divisions = input.time ?? DEFAULT_DIVISIONS;
  const time = {
    divisions,
    units: timeUnits(planet.secondsPerDay, divisions),
    leapCycles: leapCycleCandidates(planet.yearLocalDays),
  };
  return { star, planet, moon, time };
}

export * from "./star.js";
export * from "./planet.js";
export * from "./moon.js";
export * from "./calendar.js";
export * from "./units.js";
