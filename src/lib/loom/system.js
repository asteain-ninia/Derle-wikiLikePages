// 出星系の計算結果と単位表を一度だけ作って共有する (記事の値・計算機の両方で使う)

import { computeSystem } from "./index.js";
import { DERLE_INPUT } from "./derle.js";
import { buildUnits } from "./quantities.js";

let cached = null;

export function getDerleSystem() {
  if (!cached) {
    const system = computeSystem(DERLE_INPUT);
    cached = { system, units: buildUnits(system) };
  }
  return cached;
}
