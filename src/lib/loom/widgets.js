// 記事に埋め込む計算機。{{計算機|種類}} の場所に置かれる。
// renderLoomCalculator は HTML を返すだけ (ビルド時・SPA の両方で使う)。JavaScript がなくても例の値が見える。
// mountLoomCalculators はブラウザで入力欄に動きを付ける。

import { getDerleSystem } from "./system.js";
import { convertFromSi, convertToSi, formatNumber } from "./quantities.js";
import { earthToLocal, localToEarth, monthsInYear, EPOCH } from "./calendar.js";

const UNIT_DIMENSIONS = ["長さ", "質量", "温度", "圧力", "加速度", "密度", "速さ", "時間"];
const DEFAULTS = { dimension: "長さ", value: 1, unit: "pasqil" };

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// ── 単位換算 ────────────────────────────────

function unitRows(dimension, value, unit) {
  const { units } = getDerleSystem();
  const si = convertToSi(units, dimension, value, unit);
  return Object.keys(units[dimension])
    .map((name) => `<tr><th scope="row">${escapeHtml(name)}</th><td>${escapeHtml(formatNumber(convertFromSi(units, dimension, si, name), 6))}</td></tr>`)
    .join("");
}

function unitOptions(dimension, selected) {
  const { units } = getDerleSystem();
  return Object.keys(units[dimension])
    .map((name) => `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
}

function renderUnitCalculator() {
  const { dimension, value, unit } = DEFAULTS;
  const dimensionOptions = UNIT_DIMENSIONS.map(
    (name) => `<option value="${name}"${name === dimension ? " selected" : ""}>${name}</option>`
  ).join("");
  return `
    <div class="loom-calc" data-loom-calc="単位">
      <p class="loom-calc__title">単位の換算</p>
      <div class="loom-calc__controls">
        <label>量 <select data-role="dimension">${dimensionOptions}</select></label>
        <label>値 <input type="number" step="any" data-role="value" value="${value}"></label>
        <label>単位 <select data-role="unit">${unitOptions(dimension, unit)}</select></label>
      </div>
      <table class="wikitable loom-calc__table"><tbody data-role="result">${unitRows(dimension, value, unit)}</tbody></table>
      <p class="loom-calc__note">秒・分・時・日・年は出星のもの。地球の時間には「地球」を付けた。</p>
    </div>`;
}

function mountUnitCalculator(root) {
  const dimensionSelect = root.querySelector('[data-role="dimension"]');
  const valueInput = root.querySelector('[data-role="value"]');
  const unitSelect = root.querySelector('[data-role="unit"]');
  const result = root.querySelector('[data-role="result"]');
  const update = () => {
    const value = Number(valueInput.value);
    if (!Number.isFinite(value)) return;
    result.innerHTML = unitRows(dimensionSelect.value, value, unitSelect.value);
  };
  dimensionSelect.addEventListener("change", () => {
    unitSelect.innerHTML = unitOptions(dimensionSelect.value, null);
    update();
  });
  valueInput.addEventListener("input", update);
  unitSelect.addEventListener("change", update);
}

// ── 時刻 ────────────────────────────────

function timeParams() {
  const { system } = getDerleSystem();
  return { dayEarthSeconds: system.planet.secondsPerDay, yearLocalDays: system.planet.yearLocalDays };
}

const pad = (n) => String(n).padStart(2, "0");

export function formatLocalDate(local) {
  if (local.monthless) {
    return local.month === monthsInYear(local.year)
      ? `シェル暦 ${local.year} 年 年末の月なしの日`
      : `シェル暦 ${local.year} 年 ${local.month} 月と ${local.month + 1} 月のあいだの月なしの日`;
  }
  return `シェル暦 ${local.year} 年 ${local.month} 月 ${local.day} 日 (週の ${local.weekday + 1} 日目)`;
}

export function formatLocalTime(local) {
  // 39.9999… 秒を 39 秒と切り捨てないよう、ごくわずかに足してから切り捨てる
  return `${formatLocalDate(local)} ${local.hour} 時 ${pad(local.minute)} 分 ${pad(Math.floor(local.second + 1e-6))} 秒`;
}

function formatEarthTime(date) {
  const utc = date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
  return utc;
}

function renderTimeCalculator() {
  const epochDate = new Date(EPOCH.earthIso);
  const local = earthToLocal(epochDate, timeParams());
  return `
    <div class="loom-calc" data-loom-calc="時刻">
      <p class="loom-calc__title">地球の時刻と出星の時刻</p>
      <p class="loom-calc__now" data-role="now">基準点: ${escapeHtml(formatEarthTime(epochDate))} ＝ ${escapeHtml(formatLocalTime(local))}</p>
      <div class="loom-calc__controls">
        <label>地球の時刻 <input type="datetime-local" step="1" data-role="earth"></label>
        <span class="loom-calc__arrow">→</span>
        <output data-role="earth-result">—</output>
      </div>
      <div class="loom-calc__controls">
        <label>年 <input type="number" data-role="year" value="${local.year}"></label>
        <label>月 <input type="number" min="1" max="14" data-role="month" value="${local.month}"></label>
        <label>日 <input type="number" min="1" max="28" data-role="day" value="${local.day ?? 1}"></label>
        <label><input type="checkbox" data-role="monthless"> この月の後の月なしの日</label>
        <label>時 <input type="number" min="0" data-role="hour" value="${local.hour}"></label>
        <label>分 <input type="number" min="0" data-role="minute" value="${local.minute}"></label>
        <label>秒 <input type="number" min="0" data-role="second" value="${Math.floor(local.second + 1e-6)}"></label>
        <span class="loom-calc__arrow">→</span>
        <output data-role="local-result">${escapeHtml(formatEarthTime(epochDate))}</output>
      </div>
      <p class="loom-calc__note">地球の時刻は、入力欄ではこの端末の時間帯、結果は協定世界時 (UTC) で示す。シェル暦は一か月 28 日・平年 14 か月、月と月のあいだに月なしの日を置き、53 年に 1 度 13 か月の年がある (仮決め)。過去の改暦は入っていないので、遠い昔の日付は現行の規則をさかのぼって当てはめた値。</p>
    </div>`;
}

function mountTimeCalculator(root) {
  const params = timeParams();
  const nowLine = root.querySelector('[data-role="now"]');
  const earthInput = root.querySelector('[data-role="earth"]');
  const earthResult = root.querySelector('[data-role="earth-result"]');
  const localResult = root.querySelector('[data-role="local-result"]');
  const field = (role) => root.querySelector(`[data-role="${role}"]`);

  const tick = () => {
    nowLine.textContent = `いまの出星の時刻: ${formatLocalTime(earthToLocal(new Date(), params))}`;
  };
  tick();
  const timer = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(timer);
      return;
    }
    tick();
  }, 500);

  const updateEarth = () => {
    const date = new Date(earthInput.value);
    if (Number.isNaN(date.getTime())) return;
    earthResult.textContent = formatLocalTime(earthToLocal(date, params));
  };
  const LOCAL_FIELDS = ["year", "month", "day", "hour", "minute", "second"];
  const updateLocal = () => {
    const local = Object.fromEntries(LOCAL_FIELDS.map((role) => [role, Number(field(role).value)]));
    if (Object.values(local).some((v) => !Number.isFinite(v))) return;
    try {
      const date = localToEarth({ ...local, monthless: field("monthless").checked }, params);
      localResult.textContent = Number.isNaN(date.getTime()) ? "—" : formatEarthTime(date);
    } catch (error) {
      // 13 か月の年の 14 月、年の変わり目の月なしの日など、ない日付
      localResult.textContent = `（${error.message}）`;
    }
  };

  // 入力欄の初期値をいまの時刻にする
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  earthInput.value = localNow;
  updateEarth();

  earthInput.addEventListener("input", updateEarth);
  for (const role of LOCAL_FIELDS) field(role).addEventListener("input", updateLocal);
  field("monthless").addEventListener("change", updateLocal);
}

// ── 入口 ────────────────────────────────

const CALCULATORS = {
  単位: { render: renderUnitCalculator, mount: mountUnitCalculator },
  時刻: { render: renderTimeCalculator, mount: mountTimeCalculator },
};

export const CALCULATOR_KINDS = Object.keys(CALCULATORS);

export function renderLoomCalculator(kind) {
  const calc = Object.hasOwn(CALCULATORS, kind) ? CALCULATORS[kind] : null;
  if (!calc) {
    return `<p class="loom-calc loom-calc--error">〔計算機「${escapeHtml(kind)}」はありません。使えるのは ${CALCULATOR_KINDS.join("・")}〕</p>`;
  }
  return calc.render();
}

export function mountLoomCalculators(root) {
  for (const element of root.querySelectorAll("[data-loom-calc]")) {
    if (element.dataset.loomMounted) continue;
    const kind = element.dataset.loomCalc;
    if (!Object.hasOwn(CALCULATORS, kind)) continue;
    const calc = CALCULATORS[kind];
    element.dataset.loomMounted = "true";
    calc.mount(element);
  }
}
