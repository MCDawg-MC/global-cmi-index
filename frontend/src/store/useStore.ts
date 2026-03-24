import { create } from 'zustand';
import type { Country, CountryMomentum, TimeseriesPoint } from '../types';
import { fetchCountries, fetchCountryMomentum, fetchTimeseries } from '../api/client';

interface AppState {
  countries: Country[];
  selectedCountryCode: string | null;
  countryMomentum: CountryMomentum | null;
  timeseries: TimeseriesPoint[];
  loadingCountries: boolean;
  loadingDetail: boolean;
  error: string | null;
  lastUpdated: Date | null;

  loadCountries: () => Promise<void>;
  selectCountry: (code: string | null) => Promise<void>;
  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  countries: [],
  selectedCountryCode: null,
  countryMomentum: null,
  timeseries: [],
  loadingCountries: false,
  loadingDetail: false,
  error: null,
  lastUpdated: null,

  loadCountries: async () => {
    set({ loadingCountries: true, error: null });
    try {
      const countries = await fetchCountries();
      set({ countries, loadingCountries: false, lastUpdated: new Date() });
    } catch (err: any) {
      set({
        loadingCountries: false,
        error: err?.message || 'Failed to load countries',
      });
    }
  },

  selectCountry: async (code: string | null) => {
    if (!code) {
      set({ selectedCountryCode: null, countryMomentum: null, timeseries: [] });
      return;
    }

    set({ selectedCountryCode: code, loadingDetail: true, error: null });
    try {
      const [momentum, ts] = await Promise.all([
        fetchCountryMomentum(code),
        fetchTimeseries(code),
      ]);
      set({ countryMomentum: momentum, timeseries: ts, loadingDetail: false });
    } catch (err: any) {
      set({
        loadingDetail: false,
        error: err?.message || `Failed to load data for ${code}`,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
