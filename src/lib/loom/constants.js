// 出界の織機 (自前の惑星計算機) で使う物理定数と基準天体の値。
// できるだけ公的な推奨値を使う。出典は各行のコメントと docs/loom.md を参照。

// CODATA 2018
export const G = 6.6743e-11; // 万有引力定数 [m³ kg⁻¹ s⁻²]
export const SIGMA = 5.670374419e-8; // シュテファン=ボルツマン定数 [W m⁻² K⁻⁴]
export const R_GAS = 8.314462618; // 気体定数 [J mol⁻¹ K⁻¹]

// IAU 2012 Resolution B2
export const AU_M = 149_597_870_700; // 天文単位 [m]

// IAU 2015 Resolution B3 (太陽の公称値)
export const SUN = {
  mass: 1.98847e30, // [kg] (GM☉ ÷ G)
  radius: 6.957e8, // [m]
  luminosity: 3.828e26, // [W]
  teff: 5772, // [K]
};
SUN.density = SUN.mass / ((4 / 3) * Math.PI * SUN.radius ** 3) / 1000; // [g/cm³] ≒ 1.410

// IAU 2015 Resolution B3 の公称地球半径と、地球質量 (GM⊕ ÷ G)
export const EARTH = {
  mass: 5.9722e24, // [kg]
  radius: 6.371e6, // [m] 平均半径
  density: 5.514, // [g/cm³]
  gravity: 9.80665, // [m/s²] 標準重力加速度 (CGPM 1901)
  escapeVelocity: 11.186, // [km/s]
  surfaceTemperature: 288, // [K] 全球平均地表温度
  siderealYearDays: 365.256363, // [日] 恒星年
  tropicalYearDays: 365.24219, // [日] 太陽年 (回帰年)
  obliquity: 23.44, // [°]
  eccentricity: 0.0167,
};

// 月 (NASA Moon Fact Sheet)
export const MOON = {
  mass: 7.342e22, // [kg]
  radius: 1.7374e6, // [m]
  density: 3.344, // [g/cm³]
  semiMajorAxis: 3.844e8, // [m]
  eccentricity: 0.0549,
  inclination: 5.145, // [°] 黄道面に対して
};

export const SECONDS_PER_DAY = 86_400;
export const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY; // ユリウス年
