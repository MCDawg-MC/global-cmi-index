/**
 * API client — uses synthetic data engine client-side.
 * No backend required: all data is generated deterministically from
 * the Macro Momentum formula with realistic country-specific parameters.
 *
 * To switch to a live backend, set VITE_API_URL and set VITE_USE_MOCK=false.
 */
import type { Country, CountryMomentum, TimeseriesPoint, CompareCountryData } from '../types';
import {
  getCountries,
  getCountryMomentum,
  getTimeseries,
  getCompare,
} from '../data/mockEngine';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// Simulated network latency (ms) — makes the UI feel real
const delay = (ms = 120) => new Promise(res => setTimeout(res, ms));

// ---------------------------------------------------------------------------
// Live API client (only used when VITE_USE_MOCK=false)
// ---------------------------------------------------------------------------
async function liveGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const base = import.meta.env.VITE_API_URL || '';
  const url  = new URL(`${base}${path}`, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const fetchCountries = async (): Promise<Country[]> => {
  if (USE_MOCK) { await delay(80); return getCountries(); }
  return liveGet<Country[]>('/api/countries');
};

export const fetchCountryMomentum = async (code: string): Promise<CountryMomentum> => {
  if (USE_MOCK) { await delay(100); return getCountryMomentum(code); }
  return liveGet<CountryMomentum>(`/api/momentum/${code}`);
};

export const fetchTimeseries = async (code: string): Promise<TimeseriesPoint[]> => {
  if (USE_MOCK) { await delay(80); return getTimeseries(code); }
  return liveGet<TimeseriesPoint[]>(`/api/momentum/timeseries/${code}`);
};

export const fetchCompare = async (codes: string[]): Promise<CompareCountryData[]> => {
  if (USE_MOCK) { await delay(120); return getCompare(codes); }
  return liveGet<CompareCountryData[]>('/api/momentum/compare', { countries: codes.join(',') });
};

export const triggerDataUpdate = async (): Promise<void> => {
  if (USE_MOCK) { await delay(200); return; }
  await fetch(`${import.meta.env.VITE_API_URL || ''}/api/data/update`, { method: 'POST' });
};

export const fetchHealth = async () => {
  if (USE_MOCK) { await delay(30); return { status: 'ok', mode: 'synthetic' }; }
  return liveGet('/api/health');
};

export default { fetchCountries, fetchCountryMomentum, fetchTimeseries, fetchCompare };
