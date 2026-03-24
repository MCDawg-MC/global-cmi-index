export interface Country {
  code: string;
  name: string;
  region: string;
  momentum_score: number | null;
  momentum_category:
    | 'Strongly Accelerating'
    | 'Accelerating'
    | 'Stable'
    | 'Decelerating'
    | 'Strongly Decelerating'
    | null;
  global_rank: number | null;
  momentum_change_1m: number | null;
  data_completeness: number | null;
}

export interface IndicatorData {
  name: string;
  value: number | null;
  level_score: number | null;
  trend_score: number | null;
  accel_score: number | null;
  momentum: number | null;
}

export interface PillarData {
  name: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  indicators: IndicatorData[];
}

export interface CountryMomentum {
  country: Country;
  latest_score: number | null;
  momentum_category: string | null;
  pillars: PillarData[];
  changes: {
    '1m': number | null;
    '3m': number | null;
    '6m': number | null;
  };
}

export interface TimeseriesPoint {
  date: string;
  momentum_score: number | null;
  fx_capital: number | null;
  domestic_demand: number | null;
  industrial: number | null;
  trade: number | null;
  labor: number | null;
  credit: number | null;
  market_sentiment: number | null;
  inflation: number | null;
}

export interface CompareCountryData {
  country: Country;
  latest_score: number | null;
  pillars: PillarData[];
  timeseries: TimeseriesPoint[];
}

export type MomentumCategory =
  | 'Strongly Accelerating'
  | 'Accelerating'
  | 'Stable'
  | 'Decelerating'
  | 'Strongly Decelerating';
