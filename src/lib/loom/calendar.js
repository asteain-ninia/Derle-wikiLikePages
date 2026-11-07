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

// ── シェル暦 (計算暦。2026-11-08 仮決め) ─────────────────
// ・一か月は 28 日 (ちょうど 4 週)。
// ・月と月のあいだに、どの月にも週にも属さない「月なしの日」を 1 日置く (新月の日)。
//   朔望月 ≒ 28.93 日なので、これで月相に合う。一年のうち 1 か所だけ月なしの日を置かない。
// ・平年は 14 か月 (28 × 14 + 13 = 405 日)。53 年に 1 度、月を 1 つ抜いて 13 か月 (28 × 13 + 12 = 376 日) にする。
// 補正なしでは月相と約 160 年、季節と約 190 年で 1 日ずれる。過去の改暦はまだ設定がないので、
// 基準点 (2551 年) から前後に、この規則をそのまま当てはめて数える。
export const SHELL_CALENDAR = {
  monthDays: 28,
  monthsPerYear: 14,
  shortYearMonths: 13,
  cycleYears: 53,
  shortYearInCycle: 52, // 年 ÷ 53 の余りがこの値の年が、月を抜く年 (… 2543・2596 …)
  noMonthlessAfter: "last", // 月なしの日を置かない月の変わり目。"last" = 年の変わり目。数 k なら k 月の後
  weekDays: 7,
};

// 地球の時刻と出星の時刻の対応。
// 基準点: 地球の 2018-04-29T09:00:00Z を、シェル暦 2551 年 1 月 9 日 3 時 26 分 40 秒 とする。
export const EPOCH = {
  earthIso: "2018-04-29T09:00:00Z",
  year: 2551,
  month: 1,
  day: 9,
  hour: 3,
  minute: 26,
  second: 40,
};

const mod = (a, n) => ((a % n) + n) % n;

export function isShortYear(year, cal = SHELL_CALENDAR) {
  return mod(year, cal.cycleYears) === cal.shortYearInCycle;
}

export function monthsInYear(year, cal = SHELL_CALENDAR) {
  return isShortYear(year, cal) ? cal.shortYearMonths : cal.monthsPerYear;
}

// m 月の後に月なしの日があるか
export function hasMonthlessAfter(year, month, cal = SHELL_CALENDAR) {
  const months = monthsInYear(year, cal);
  const skip = cal.noMonthlessAfter === "last" ? months : Math.min(cal.noMonthlessAfter, months);
  return month !== skip;
}

export function yearLength(year, cal = SHELL_CALENDAR) {
  const months = monthsInYear(year, cal);
  return months * cal.monthDays + (months - 1);
}

// 年の 1 日目 (0 始まりの通し番号) から日付へ
function dateFromDayIndex(year, index, cal) {
  let rest = index;
  const months = monthsInYear(year, cal);
  for (let month = 1; month <= months; month += 1) {
    if (rest < cal.monthDays) {
      return { month, day: rest + 1, monthless: false, weekday: rest % cal.weekDays };
    }
    rest -= cal.monthDays;
    if (hasMonthlessAfter(year, month, cal)) {
      if (rest === 0) return { month, day: null, monthless: true, weekday: null };
      rest -= 1;
    }
  }
  throw new RangeError(`${year} 年に ${index + 1} 日目はない`);
}

// 日付から年の通し番号 (0 始まり) へ。月なしの日は { month: その前の月, monthless: true }
function dayIndexFromDate(year, { month, day, monthless = false }, cal) {
  const months = monthsInYear(year, cal);
  if (!(month >= 1 && month <= months)) throw new RangeError(`${year} 年に ${month} 月はない`);
  let index = 0;
  for (let m = 1; m < month; m += 1) index += cal.monthDays + (hasMonthlessAfter(year, m, cal) ? 1 : 0);
  if (monthless) {
    if (!hasMonthlessAfter(year, month, cal)) throw new RangeError(`${year} 年の ${month} 月の後に月なしの日はない`);
    return index + cal.monthDays;
  }
  if (!(day >= 1 && day <= cal.monthDays)) throw new RangeError(`一か月は ${cal.monthDays} 日まで`);
  return index + day - 1;
}

// 基準点の年の 1 日目から、ある年の 1 日目までの日数 (前の年なら負)
function yearStartOffset(year, epochYear, cal) {
  let days = 0;
  for (let y = epochYear; y < year; y += 1) days += yearLength(y, cal);
  for (let y = year; y < epochYear; y += 1) days -= yearLength(y, cal);
  return days;
}

function timeOfDayFraction({ hour, minute, second }, div, secondsPerDay) {
  return ((hour * div.minutesPerHour + minute) * div.secondsPerMinute + second) / secondsPerDay;
}

// 地球の時刻 (Date) → シェル暦の日付と時刻
export function earthToLocal(date, { dayEarthSeconds }, div = DEFAULT_DIVISIONS, epoch = EPOCH, cal = SHELL_CALENDAR) {
  const units = timeUnits(dayEarthSeconds, div);
  const epochPos = dayIndexFromDate(epoch.year, epoch, cal) + timeOfDayFraction(epoch, div, units.secondsPerDay);
  const elapsedDays = (date.getTime() - Date.parse(epoch.earthIso)) / 1000 / dayEarthSeconds;

  // 地球の時刻 (Date) はミリ秒単位なので、境目の手前 2 ミリ秒以内は境目ちょうどとみなす
  const eps = 0.002 / dayEarthSeconds;
  let year = epoch.year;
  let pos = epochPos + elapsedDays; // その年の 1 日目 0 時からの経過日数
  while (pos < -eps) {
    year -= 1;
    pos += yearLength(year, cal);
  }
  while (pos >= yearLength(year, cal) - eps) {
    pos -= yearLength(year, cal);
    year += 1;
  }
  const index = Math.min(Math.max(0, Math.floor(pos + eps)), yearLength(year, cal) - 1);
  const fraction = Math.max(0, pos - index);

  let rest = fraction * units.secondsPerDay;
  const hour = Math.floor(rest / (div.minutesPerHour * div.secondsPerMinute));
  rest -= hour * div.minutesPerHour * div.secondsPerMinute;
  const minute = Math.floor(rest / div.secondsPerMinute);
  const second = rest - minute * div.secondsPerMinute;

  return { elapsedDays, year, dayOfYear: index + 1, ...dateFromDayIndex(year, index, cal), hour, minute, second };
}

// シェル暦の日付と時刻 → 地球の時刻 (Date)。earthToLocal の逆
export function localToEarth(local, { dayEarthSeconds }, div = DEFAULT_DIVISIONS, epoch = EPOCH, cal = SHELL_CALENDAR) {
  const units = timeUnits(dayEarthSeconds, div);
  const epochPos = dayIndexFromDate(epoch.year, epoch, cal) + timeOfDayFraction(epoch, div, units.secondsPerDay);
  const pos =
    yearStartOffset(local.year, epoch.year, cal) +
    dayIndexFromDate(local.year, local, cal) +
    timeOfDayFraction(local, div, units.secondsPerDay);
  return new Date(Date.parse(epoch.earthIso) + (pos - epochPos) * dayEarthSeconds * 1000);
}
