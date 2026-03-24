/**
 * Macro Momentum Index — Synthetic Data Engine
 *
 * Implements the full momentum formula client-side:
 *   level_score  = (current - hist_mean) / hist_std
 *   trend_score  = (current - value_6mo_ago) / hist_std
 *   accel_score  = ((current - value_6mo_ago) - (value_6mo_ago - value_12mo_ago)) / hist_std
 *   momentum     = 0.2*level + 0.6*trend + 0.2*accel
 *   (inverted for lower_is_better indicators: CPI, unemployment)
 *
 * Generates 60 months of AR(1) synthetic history, calculates all pillar & country
 * momentum scores, and returns data in the exact shape the API would return.
 *
 * Sources for realistic parameter ranges:
 *   - IMF World Economic Outlook (April 2024)
 *   - OECD Economic Outlook No.115 (2024)
 *   - BIS Quarterly Review (March 2024)
 *   - S&P Global PMI releases (2024)
 */

import type {
  Country,
  CountryMomentum,
  TimeseriesPoint,
  CompareCountryData,
  PillarData,
  IndicatorData,
} from '../types';

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32 (deterministic, reproducible)
// ---------------------------------------------------------------------------
function makePRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randNormal(rng: () => number): number {
  // Box-Muller
  const u = 1 - rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNTRIES_DEF = [
  { code: 'USA', name: 'United States',  region: 'North America' },
  { code: 'DEU', name: 'Germany',         region: 'Europe' },
  { code: 'GBR', name: 'United Kingdom',  region: 'Europe' },
  { code: 'JPN', name: 'Japan',           region: 'Asia Pacific' },
  { code: 'CHN', name: 'China',           region: 'Asia Pacific' },
  { code: 'CAN', name: 'Canada',          region: 'North America' },
  { code: 'AUS', name: 'Australia',       region: 'Asia Pacific' },
  { code: 'KOR', name: 'South Korea',     region: 'Asia Pacific' },
  { code: 'BRA', name: 'Brazil',          region: 'Latin America' },
  { code: 'EUR', name: 'Euro Area',       region: 'Europe' },
] as const;

type CountryCode = typeof COUNTRIES_DEF[number]['code'];

interface IndicatorConfig {
  mean: number;
  std: number;
  lower_is_better: boolean;
  ar_coef: number; // AR(1) coefficient
}

const INDICATOR_CONFIG: Record<string, IndicatorConfig> = {
  manufacturing_pmi:       { mean: 50.0, std: 3.0,  lower_is_better: false, ar_coef: 0.75 },
  industrial_production_yoy:{ mean: 2.0,  std: 4.0,  lower_is_better: false, ar_coef: 0.70 },
  retail_sales_yoy:        { mean: 3.0,  std: 5.0,  lower_is_better: false, ar_coef: 0.65 },
  employment_change:       { mean: 0.1,  std: 0.3,  lower_is_better: false, ar_coef: 0.60 },
  wage_growth_yoy:         { mean: 3.0,  std: 2.0,  lower_is_better: false, ar_coef: 0.80 },
  core_cpi_yoy:            { mean: 2.5,  std: 1.5,  lower_is_better: true,  ar_coef: 0.85 },
  exports_yoy:             { mean: 3.0,  std: 8.0,  lower_is_better: false, ar_coef: 0.55 },
  trade_balance_gdp:       { mean: 0.0,  std: 3.0,  lower_is_better: false, ar_coef: 0.70 },
  corporate_credit_yoy:    { mean: 4.0,  std: 6.0,  lower_is_better: false, ar_coef: 0.72 },
  fx_3mo_change:           { mean: 0.0,  std: 3.0,  lower_is_better: false, ar_coef: 0.30 },
  equity_3mo_return:       { mean: 2.0,  std: 8.0,  lower_is_better: false, ar_coef: 0.40 },
  sovereign_spread_10y:    { mean: 1.5,  std: 0.8,  lower_is_better: true,  ar_coef: 0.80 },
};

// Country-specific drift biases to create interesting, realistic differentials
// Positive = strong momentum bias, negative = weak/declining
const COUNTRY_BIASES: Record<CountryCode, Record<string, number>> = {
  USA: {
    manufacturing_pmi: 0.8, industrial_production_yoy: 0.6, retail_sales_yoy: 1.2,
    employment_change: 0.9, wage_growth_yoy: 0.5, core_cpi_yoy: -0.3,
    exports_yoy: 0.4, trade_balance_gdp: -0.8, corporate_credit_yoy: 0.7,
    fx_3mo_change: 0.5, equity_3mo_return: 1.5, sovereign_spread_10y: -0.2,
  },
  DEU: {
    manufacturing_pmi: -1.5, industrial_production_yoy: -1.2, retail_sales_yoy: -0.8,
    employment_change: -0.3, wage_growth_yoy: 0.8, core_cpi_yoy: 0.5,
    exports_yoy: -0.9, trade_balance_gdp: 0.5, corporate_credit_yoy: -0.4,
    fx_3mo_change: -0.3, equity_3mo_return: -0.6, sovereign_spread_10y: -0.1,
  },
  GBR: {
    manufacturing_pmi: -0.6, industrial_production_yoy: -0.4, retail_sales_yoy: -0.5,
    employment_change: 0.1, wage_growth_yoy: 1.2, core_cpi_yoy: 0.8,
    exports_yoy: -0.5, trade_balance_gdp: -1.0, corporate_credit_yoy: 0.2,
    fx_3mo_change: -0.4, equity_3mo_return: 0.3, sovereign_spread_10y: 0.3,
  },
  JPN: {
    manufacturing_pmi: 0.3, industrial_production_yoy: 0.5, retail_sales_yoy: 0.7,
    employment_change: 0.2, wage_growth_yoy: 1.8, core_cpi_yoy: 0.4,
    exports_yoy: 0.8, trade_balance_gdp: -0.3, corporate_credit_yoy: 0.5,
    fx_3mo_change: -1.2, equity_3mo_return: 1.8, sovereign_spread_10y: -0.5,
  },
  CHN: {
    manufacturing_pmi: 0.5, industrial_production_yoy: 1.2, retail_sales_yoy: 1.5,
    employment_change: 0.4, wage_growth_yoy: 0.6, core_cpi_yoy: -0.8,
    exports_yoy: 1.8, trade_balance_gdp: 1.5, corporate_credit_yoy: 1.2,
    fx_3mo_change: -0.2, equity_3mo_return: -0.4, sovereign_spread_10y: 0.1,
  },
  CAN: {
    manufacturing_pmi: 0.1, industrial_production_yoy: 0.3, retail_sales_yoy: 0.2,
    employment_change: 0.3, wage_growth_yoy: 0.4, core_cpi_yoy: -0.1,
    exports_yoy: 0.6, trade_balance_gdp: 0.2, corporate_credit_yoy: -0.2,
    fx_3mo_change: 0.1, equity_3mo_return: 0.5, sovereign_spread_10y: 0.0,
  },
  AUS: {
    manufacturing_pmi: 0.4, industrial_production_yoy: 0.8, retail_sales_yoy: 0.6,
    employment_change: 0.5, wage_growth_yoy: 0.7, core_cpi_yoy: 0.2,
    exports_yoy: 1.0, trade_balance_gdp: 1.2, corporate_credit_yoy: 0.3,
    fx_3mo_change: 0.2, equity_3mo_return: 0.7, sovereign_spread_10y: -0.1,
  },
  KOR: {
    manufacturing_pmi: 0.6, industrial_production_yoy: 1.0, retail_sales_yoy: 0.8,
    employment_change: 0.3, wage_growth_yoy: 0.5, core_cpi_yoy: -0.2,
    exports_yoy: 1.4, trade_balance_gdp: 0.8, corporate_credit_yoy: 0.6,
    fx_3mo_change: -0.3, equity_3mo_return: 1.0, sovereign_spread_10y: -0.2,
  },
  BRA: {
    manufacturing_pmi: -0.4, industrial_production_yoy: -0.2, retail_sales_yoy: 0.3,
    employment_change: 0.1, wage_growth_yoy: -0.5, core_cpi_yoy: 1.2,
    exports_yoy: 0.5, trade_balance_gdp: 0.4, corporate_credit_yoy: -0.8,
    fx_3mo_change: -0.8, equity_3mo_return: -0.5, sovereign_spread_10y: 0.8,
  },
  EUR: {
    manufacturing_pmi: -1.0, industrial_production_yoy: -0.8, retail_sales_yoy: -0.6,
    employment_change: 0.0, wage_growth_yoy: 0.6, core_cpi_yoy: 0.3,
    exports_yoy: -0.4, trade_balance_gdp: 0.2, corporate_credit_yoy: -0.5,
    fx_3mo_change: -0.2, equity_3mo_return: -0.3, sovereign_spread_10y: 0.2,
  },
};

// Pillar definitions: name → { weight, indicators[] }
const PILLARS: Record<string, { weight: number; indicators: string[] }> = {
  fx_capital:       { weight: 0.20, indicators: ['fx_3mo_change'] },
  domestic_demand:  { weight: 0.18, indicators: ['retail_sales_yoy'] },
  industrial:       { weight: 0.16, indicators: ['manufacturing_pmi', 'industrial_production_yoy'] },
  trade:            { weight: 0.14, indicators: ['exports_yoy', 'trade_balance_gdp'] },
  labor:            { weight: 0.12, indicators: ['employment_change', 'wage_growth_yoy'] },
  credit:           { weight: 0.10, indicators: ['corporate_credit_yoy'] },
  market_sentiment: { weight: 0.10, indicators: ['equity_3mo_return', 'sovereign_spread_10y'] },
  inflation:        { weight: 0.08, indicators: ['core_cpi_yoy'] },
};

const PILLAR_NAMES = Object.keys(PILLARS);

// ---------------------------------------------------------------------------
// Time series generation
// ---------------------------------------------------------------------------

function generateTimeSeries(
  cfg: IndicatorConfig,
  bias: number,
  months: number,
  rng: () => number
): number[] {
  const values: number[] = [];
  let prev = cfg.mean + bias * cfg.std * 0.5;

  for (let i = 0; i < months; i++) {
    const shock = randNormal(rng) * cfg.std * Math.sqrt(1 - cfg.ar_coef ** 2);
    const drift = bias * cfg.std * 0.03; // slow drift toward bias
    const next = cfg.mean * (1 - cfg.ar_coef) + prev * cfg.ar_coef + shock + drift;
    values.push(parseFloat(next.toFixed(3)));
    prev = next;
  }
  return values;
}

// ---------------------------------------------------------------------------
// Momentum calculation (exact formula)
// ---------------------------------------------------------------------------

interface MomentumScores {
  level: number;
  trend: number;
  accel: number;
  momentum: number;
  currentValue: number;
}

function calcMomentum(
  values: number[],
  cfg: IndicatorConfig,
  monthIdx: number // index of "current" month (0-based from start)
): MomentumScores | null {
  if (monthIdx < 12) return null;

  const current   = values[monthIdx];
  const v6mo      = values[monthIdx - 6];
  const v12mo     = values[monthIdx - 12];

  // Historical stats from the full series up to monthIdx
  const hist = values.slice(0, monthIdx + 1);
  const hist_mean = hist.reduce((a, b) => a + b, 0) / hist.length;
  const hist_std  = Math.sqrt(
    hist.reduce((a, b) => a + (b - hist_mean) ** 2, 0) / hist.length
  ) || 1;

  const level = (current - hist_mean) / hist_std;
  const trend = (current - v6mo) / hist_std;
  const accel = ((current - v6mo) - (v6mo - v12mo)) / hist_std;

  let m = 0.2 * level + 0.6 * trend + 0.2 * accel;
  if (cfg.lower_is_better) m = -m;

  // Clamp to ±4 for sanity
  m = Math.max(-4, Math.min(4, m));

  return {
    level:  parseFloat(level.toFixed(4)),
    trend:  parseFloat(trend.toFixed(4)),
    accel:  parseFloat(accel.toFixed(4)),
    momentum: parseFloat(m.toFixed(4)),
    currentValue: current,
  };
}

function getCategory(score: number): Country['momentum_category'] {
  if (score >= 2.0)  return 'Strongly Accelerating';
  if (score >= 1.0)  return 'Accelerating';
  if (score >= -1.0) return 'Stable';
  if (score >= -2.0) return 'Decelerating';
  return 'Strongly Decelerating';
}

// ---------------------------------------------------------------------------
// Build the full dataset
// ---------------------------------------------------------------------------

const MONTHS = 60; // 5 years of history
const TIMESERIES_MONTHS = 12; // 12 months returned in timeseries

// Generate dates (from 60 months ago to now)
function buildDates(n: number): string[] {
  const dates: string[] = [];
  const now = new Date(2026, 2, 1); // March 2026 (currentDate context)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const ALL_DATES = buildDates(MONTHS);
const LAST_12_DATES = ALL_DATES.slice(-TIMESERIES_MONTHS);

type SeriesMap = Record<string, Record<string, number[]>>; // country → indicator → values[]

function buildAllSeries(): SeriesMap {
  const result: SeriesMap = {};
  for (const c of COUNTRIES_DEF) {
    result[c.code] = {};
    const biases = COUNTRY_BIASES[c.code as CountryCode];
    for (const [indName, cfg] of Object.entries(INDICATOR_CONFIG)) {
      // Unique seed per country+indicator
      const seed = c.code.charCodeAt(0) * 1000 + c.code.charCodeAt(1) * 100 + indName.length * 17 + 42;
      const rng  = makePRNG(seed);
      result[c.code][indName] = generateTimeSeries(cfg, biases[indName] ?? 0, MONTHS, rng);
    }
  }
  return result;
}

interface CountryMomentumByMonth {
  pillarScores: Record<string, number | null>;
  totalMomentum: number;
  category: Country['momentum_category'];
  indicatorDetails: Record<string, MomentumScores | null>;
}

function calcCountryByMonth(
  series: Record<string, number[]>,
  monthIdx: number
): CountryMomentumByMonth {
  // 1. Calculate indicator momentums
  const indMomentums: Record<string, MomentumScores | null> = {};
  for (const [indName, cfg] of Object.entries(INDICATOR_CONFIG)) {
    indMomentums[indName] = calcMomentum(series[indName], cfg, monthIdx);
  }

  // 2. Aggregate into pillars
  const pillarScores: Record<string, number | null> = {};
  let totalMomentum = 0;
  let totalWeight = 0;

  for (const [pillarName, pillar] of Object.entries(PILLARS)) {
    const validScores = pillar.indicators
      .map(ind => indMomentums[ind]?.momentum)
      .filter((s): s is number => s !== null && s !== undefined);

    if (validScores.length === 0) {
      pillarScores[pillarName] = null;
    } else {
      const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      pillarScores[pillarName] = parseFloat(avg.toFixed(4));
      totalMomentum += avg * pillar.weight;
      totalWeight   += pillar.weight;
    }
  }

  // Reweight if some pillars missing
  const finalMomentum = totalWeight > 0
    ? parseFloat((totalMomentum / totalWeight).toFixed(4))
    : 0;

  return {
    pillarScores,
    totalMomentum: finalMomentum,
    category: getCategory(finalMomentum),
    indicatorDetails: indMomentums,
  };
}

// ---------------------------------------------------------------------------
// Build all exported data structures
// ---------------------------------------------------------------------------

const SERIES = buildAllSeries();

// Pre-compute country momentum for all months from index 12 onward
type MonthlyResult = { monthIdx: number; date: string; result: CountryMomentumByMonth };

const COUNTRY_MONTHLY: Record<string, MonthlyResult[]> = {};
for (const c of COUNTRIES_DEF) {
  COUNTRY_MONTHLY[c.code] = [];
  for (let i = 12; i < MONTHS; i++) {
    COUNTRY_MONTHLY[c.code].push({
      monthIdx: i,
      date: ALL_DATES[i],
      result: calcCountryByMonth(SERIES[c.code], i),
    });
  }
}

// Latest result per country
function latest(code: string): MonthlyResult {
  const arr = COUNTRY_MONTHLY[code];
  return arr[arr.length - 1];
}

// Global rank based on latest momentum score
const RANKS: Record<string, number> = (() => {
  const scores = COUNTRIES_DEF.map(c => ({
    code: c.code,
    score: latest(c.code).result.totalMomentum,
  }));
  scores.sort((a, b) => b.score - a.score);
  const ranks: Record<string, number> = {};
  scores.forEach((s, i) => { ranks[s.code] = i + 1; });
  return ranks;
})();

// ---------------------------------------------------------------------------
// Public API data builders
// ---------------------------------------------------------------------------

export function getCountries(): Country[] {
  return COUNTRIES_DEF.map(c => {
    const lat = latest(c.code);
    const arr = COUNTRY_MONTHLY[c.code];
    const m1 = arr.length >= 2  ? arr[arr.length - 2].result.totalMomentum  : null;
    const change1m = m1 !== null ? parseFloat((lat.result.totalMomentum - m1).toFixed(4)) : null;

    return {
      code: c.code,
      name: c.name,
      region: c.region,
      momentum_score: lat.result.totalMomentum,
      momentum_category: lat.result.category,
      global_rank: RANKS[c.code],
      momentum_change_1m: change1m,
      data_completeness: 1.0,
    };
  });
}

export function getCountryMomentum(code: string): CountryMomentum {
  const cDef = COUNTRIES_DEF.find(c => c.code === code);
  if (!cDef) throw new Error(`Unknown country: ${code}`);

  const lat  = latest(code);
  const arr  = COUNTRY_MONTHLY[code];
  const m1   = arr.length >= 2  ? arr[arr.length - 2].result.totalMomentum  : null;
  const m3   = arr.length >= 4  ? arr[arr.length - 4].result.totalMomentum  : null;
  const m6   = arr.length >= 7  ? arr[arr.length - 7].result.totalMomentum  : null;

  const country: Country = {
    code: cDef.code,
    name: cDef.name,
    region: cDef.region,
    momentum_score: lat.result.totalMomentum,
    momentum_category: lat.result.category,
    global_rank: RANKS[code],
    momentum_change_1m: m1 !== null ? parseFloat((lat.result.totalMomentum - m1).toFixed(4)) : null,
    data_completeness: 1.0,
  };

  const pillars: PillarData[] = PILLAR_NAMES.map(pillarName => {
    const pDef = PILLARS[pillarName];
    const score = lat.result.pillarScores[pillarName];

    const indicators: IndicatorData[] = pDef.indicators.map(indName => {
      const scores = lat.result.indicatorDetails[indName];
      const indCfg = INDICATOR_CONFIG[indName];
      const val    = SERIES[code][indName][lat.monthIdx];
      return {
        name: indName,
        value:       parseFloat(val.toFixed(3)),
        level_score: scores?.level   ?? null,
        trend_score: scores?.trend   ?? null,
        accel_score: scores?.accel   ?? null,
        momentum:    scores ? (indCfg.lower_is_better ? -scores.momentum : scores.momentum) : null,
      };
    });

    return {
      name: pillarName,
      weight: pDef.weight,
      score: score ?? null,
      contribution: score !== null ? parseFloat((score * pDef.weight).toFixed(4)) : null,
      indicators,
    };
  });

  return {
    country,
    latest_score: lat.result.totalMomentum,
    momentum_category: lat.result.category,
    pillars,
    changes: {
      '1m': m1 !== null ? parseFloat((lat.result.totalMomentum - m1).toFixed(4)) : null,
      '3m': m3 !== null ? parseFloat((lat.result.totalMomentum - m3).toFixed(4)) : null,
      '6m': m6 !== null ? parseFloat((lat.result.totalMomentum - m6).toFixed(4)) : null,
    },
  };
}

export function getTimeseries(code: string): TimeseriesPoint[] {
  const arr = COUNTRY_MONTHLY[code];
  const last12 = arr.slice(-TIMESERIES_MONTHS);
  return last12.map(({ date, result }) => ({
    date,
    momentum_score:   result.totalMomentum,
    fx_capital:       result.pillarScores['fx_capital']       ?? null,
    domestic_demand:  result.pillarScores['domestic_demand']  ?? null,
    industrial:       result.pillarScores['industrial']       ?? null,
    trade:            result.pillarScores['trade']            ?? null,
    labor:            result.pillarScores['labor']            ?? null,
    credit:           result.pillarScores['credit']           ?? null,
    market_sentiment: result.pillarScores['market_sentiment'] ?? null,
    inflation:        result.pillarScores['inflation']        ?? null,
  }));
}

export function getCompare(codes: string[]): CompareCountryData[] {
  return codes.map(code => {
    const cm = getCountryMomentum(code);
    return {
      country: cm.country,
      latest_score: cm.latest_score,
      pillars: cm.pillars,
      timeseries: getTimeseries(code),
    };
  });
}

// Eagerly warm up on module load (runs once, ~5ms)
export const ALL_COUNTRIES: Country[] = getCountries();
