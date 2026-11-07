// 出星の時間単位と暦の計算。
// 一日 (自転) を時・分・秒に分け、地球の時刻と行き来する。年は平均太陽年 (惑星日) で扱う。

// 連分数展開の近似分数 (閏年の入れ方の候補)。
// x の小数部 f を p/q で近似する列を返す。q 年に p 回閏年を入れると平均の一年が x に近づく。
export function leapCycleCandidates(yearLocalDays, maxTerms = 6) {
  const base = Math.floor(yearLocalDays);
  const frac = yearLocalDays - base;
  const terms = [];
  let x = frac;
  for (let i = 0; i < maxTerms && x > 1e-12; i += 1) {
    const inv = 1 / x;
    const a = Math.floor(inv);
    terms.push(a);
    x = inv - a;
  }
  // 収束分数 p/q を作る (f = 1 / (a₁ + 1 / (a₂ + …)))
  const results = [];
  let [pPrev, pCur] = [0, 1];
  let [qPrev, qCur] = [1, 0];
  for (const a of terms) {
    [pPrev, pCur] = [pCur, a * pCur + pPrev];
    [qPrev, qCur] = [qCur, a * qCur + qPrev];
    // ここでの p/q は 1/f の近似なので、f ≒ q/p (p 年に q 回)
    const years = pCur;
    const leaps = qCur;
    const meanYear = base + leaps / years;
    const drift = Math.abs(yearLocalDays - meanYear);
    results.push({ leaps, years, meanYear, yearsPerDayOfDrift: drift > 0 ? 1 / drift : Infinity });
  }
  return results;
}

// 一日の分け方。既定は 36 時 × 36 分 × 72 秒 (一日 = 93,312 秒)。
export const DEFAULT_DIVISIONS = { hoursPerDay: 36, minutesPerHour: 36, secondsPerMinute: 72 };

export function timeUnits(dayEarthSeconds, div = DEFAULT_DIVISIONS) {
  const secondsPerDay = div.hoursPerDay * div.minutesPerHour * div.secondsPerMinute;
  const second = dayEarthSeconds / secondsPerDay;
  return {
    secondsPerDay,
    second, // 地球秒
    minute: second * div.secondsPerMinute,
    hour: second * div.secondsPerMinute * div.minutesPerHour,
    day: dayEarthSeconds,
  };
}

// 地球の時刻と出星の時刻の対応。
// 基準点: 地球の 2018-04-29T09:00:00Z を、シェル暦 2551 年 1 月 9 日 3 時 26 分 40 秒 とする。
// 月の長さがまだ決まっていないので、1 月 9 日は「年の 9 日目」として扱う。
export const EPOCH = {
  earthIso: "2018-04-29T09:00:00Z",
  year: 2551,
  dayOfYear: 9, // 1 始まり
  hour: 3,
  minute: 26,
  second: 40,
};

// 地球の時刻 (Date) → 基準点からの経過惑星日数と、その日の時刻。
// 年をまたぐ計算は平均太陽年を使う近似 (閏年の規則が決まるまでの仮のもの)。
export function earthToLocal(date, { dayEarthSeconds, yearLocalDays }, div = DEFAULT_DIVISIONS, epoch = EPOCH) {
  const units = timeUnits(dayEarthSeconds, div);
  const epochMs = Date.parse(epoch.earthIso);
  const epochTimeOfDay =
    ((epoch.hour * div.minutesPerHour + epoch.minute) * div.secondsPerMinute + epoch.second) / units.secondsPerDay;
  // 基準点の年の 1 日目 0 時からの経過日数 (小数)
  const epochDays = epoch.dayOfYear - 1 + epochTimeOfDay;
  const elapsedDays = (date.getTime() - epochMs) / 1000 / dayEarthSeconds;
  const totalDays = epochDays + elapsedDays;

  const yearsFloat = totalDays / yearLocalDays;
  const yearOffset = Math.floor(yearsFloat);
  const dayInYearFloat = totalDays - yearOffset * yearLocalDays;
  const dayOfYear = Math.floor(dayInYearFloat) + 1;
  let rest = (dayInYearFloat - Math.floor(dayInYearFloat)) * units.secondsPerDay;
  const hour = Math.floor(rest / (div.minutesPerHour * div.secondsPerMinute));
  rest -= hour * div.minutesPerHour * div.secondsPerMinute;
  const minute = Math.floor(rest / div.secondsPerMinute);
  const second = rest - minute * div.secondsPerMinute;

  return { elapsedDays, year: epoch.year + yearOffset, dayOfYear, hour, minute, second };
}
