// 出度量衡 (出界の単位) と SI の換算。
// 長さ Qarli・質量 talk・温度 gal を基本とし、時間は出星の秒を使う。組立単位は SI にならう。

// 水の密度 [g/cm³] (Tanaka ほか 2001、大気圧下・空気を含まない水、0〜40 ℃)
export function waterDensity(celsius) {
  const [a1, a2, a3, a4, a5] = [-3.983035, 301.797, 522528.9, 69.34881, 999.97495];
  const t = celsius;
  return (a5 * (1 - ((t + a1) ** 2 * (t + a2)) / (a3 * (t + a4)))) / 1000;
}

// gal: 水銀の凝固点 −38.83 ℃ を 0 gal、沸点 356.7 ℃ を 500 gal とする温度目盛り
export const GAL = { zeroC: -38.83, fiveHundredC: 356.7 };
export const GAL_STEP_C = (GAL.fiveHundredC - GAL.zeroC) / 500; // 1 gal あたりの ℃ ≒ 0.79106

export function galToCelsius(gal) {
  return GAL.zeroC + gal * GAL_STEP_C;
}

export function celsiusToGal(celsius) {
  return (celsius - GAL.zeroC) / GAL_STEP_C;
}

export function kelvinToGal(kelvin) {
  return celsiusToGal(kelvin - 273.15);
}

// 長さ: 1 Qarli = 1.123 cm。100 倍ごとに firqil・lamqil・Zamqil・pasqil。
export const QARLI_M = 0.01123;
export const LENGTH_UNITS = {
  Qarli: QARLI_M,
  firqil: QARLI_M * 1e2,
  lamqil: QARLI_M * 1e4,
  Zamqil: QARLI_M * 1e6,
  pasqil: QARLI_M * 1e8,
};

// 接頭辞 (10² ごと)。10⁸ の sap は Qarli と合わさると pasqil になる (不規則形)。
export const PREFIXES = { mil: 1e-8, pix: 1e-6, jim: 1e-4, rim: 1e-2, far: 1e2, lam: 1e4, Zam: 1e6, sap: 1e8 };

// 質量: 1 talk = 1 Qarli 角の升に満たした 80 gal の水の質量
export const TALK_REFERENCE_GAL = 80;
export const TALK_KG = (waterDensity(galToCelsius(TALK_REFERENCE_GAL)) * (QARLI_M * 100) ** 3) / 1000;

// 組立単位。秒は出星の秒 (地球秒で渡す)。
export function derivedUnits(localSecondInEarthSeconds) {
  const s = localSecondInEarthSeconds;
  const dik = (TALK_KG * QARLI_M) / s ** 2; // 力 [N]
  return {
    Dik: dik,
    mos: dik / QARLI_M ** 2, // 圧力 [Pa]
    Saza: dik * QARLI_M, // 仕事 [J]
    // 水素 1 talk あたりの原子数。原案どおり水素の標準原子量 1.008 (天然の同位体比) を使う。¹H だけなら 1.00783
    tylostConstant: ((TALK_KG * 1000) / 1.008) * 6.02214076e23,
    accelerationQarli: QARLI_M / s ** 2, // 1 Qarli/秒² [m/s²]
  };
}
