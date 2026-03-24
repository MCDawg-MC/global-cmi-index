import axios from 'axios';
import type { Country, CountryMomentum, TimeseriesPoint, CompareCountryData } from '../types';

// In dev, Vite proxies /api → localhost:8000, so use empty base URL.
// In production or Docker, set VITE_API_URL explicitly.
const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

export const fetchCountries = async (): Promise<Country[]> => {
  const { data } = await api.get<Country[]>('/api/countries');
  return data;
};

export const fetchCountryMomentum = async (code: string): Promise<CountryMomentum> => {
  const { data } = await api.get<CountryMomentum>(`/api/momentum/${code}`);
  return data;
};

export const fetchTimeseries = async (code: string): Promise<TimeseriesPoint[]> => {
  const { data } = await api.get<TimeseriesPoint[]>(`/api/momentum/timeseries/${code}`);
  return data;
};

export const fetchCompare = async (codes: string[]): Promise<CompareCountryData[]> => {
  const { data } = await api.get<CompareCountryData[]>('/api/momentum/compare', {
    params: { countries: codes.join(',') },
  });
  return data;
};

export const triggerDataUpdate = async (): Promise<void> => {
  await api.post('/api/data/update');
};

export const fetchHealth = async () => {
  const { data } = await api.get('/api/health');
  return data;
};

export default api;
