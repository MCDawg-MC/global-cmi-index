import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import WorldMap from '../components/WorldMap';
import TopMovers from '../components/TopMovers';
import CountryPanel from '../components/CountryPanel';

export default function Dashboard() {
  const {
    countries,
    selectedCountryCode,
    countryMomentum,
    timeseries,
    loadingCountries,
    loadingDetail,
    error,
    loadCountries,
    selectCountry,
    lastUpdated,
  } = useStore();

  useEffect(() => {
    loadCountries();
  }, []);

  const handleCountryClick = (code: string) => {
    if (selectedCountryCode === code) {
      selectCountry(null);
    } else {
      selectCountry(code);
    }
  };

  const handleClosePanel = () => selectCountry(null);

  // Status bar data
  const accelerating = countries.filter(
    (c) => c.momentum_category === 'Accelerating' || c.momentum_category === 'Strongly Accelerating'
  ).length;
  const decelerating = countries.filter(
    (c) => c.momentum_category === 'Decelerating' || c.momentum_category === 'Strongly Decelerating'
  ).length;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>
      {/* Status bar */}
      <div className="bg-slate-800/40 border-b border-slate-800 px-4 py-2 flex items-center gap-6 text-xs">
        <span className="text-slate-500">
          {loadingCountries ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <span className="text-slate-400">{countries.length} economies tracked</span>
          )}
        </span>
        {!loadingCountries && countries.length > 0 && (
          <>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-400">
                {accelerating} accelerating
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400">
                {decelerating} decelerating
              </span>
            </span>
            {lastUpdated && (
              <span className="text-slate-600 ml-auto hidden md:block">
                Data as of {lastUpdated.toLocaleDateString()}
              </span>
            )}
          </>
        )}
        {error && (
          <span className="text-red-400 ml-auto">{error}</span>
        )}
      </div>

      {/* Map */}
      <div className="relative">
        {loadingCountries && countries.length === 0 ? (
          <div
            className="flex items-center justify-center bg-slate-800/50"
            style={{ height: '60vh' }}
          >
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-400 text-sm">Initializing data...</p>
              <p className="text-slate-600 text-xs">
                First run generates 5 years of data — this may take a minute
              </p>
            </div>
          </div>
        ) : (
          <WorldMap
            countries={countries}
            onCountryClick={handleCountryClick}
            selectedCode={selectedCountryCode}
          />
        )}
      </div>

      {/* Bottom panel */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Rankings */}
        <div
          className={`flex-none overflow-hidden border-r border-slate-800 transition-all duration-300 ${
            selectedCountryCode ? 'w-72' : 'w-full max-w-lg'
          }`}
          style={{ minHeight: '340px' }}
        >
          <div className="p-4 h-full">
            {loadingCountries && countries.length === 0 ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <TopMovers
                countries={countries}
                onSelect={handleCountryClick}
                selectedCode={selectedCountryCode}
              />
            )}
          </div>
        </div>

        {/* Country panel */}
        {selectedCountryCode && (
          <div className="flex-1 overflow-hidden">
            <CountryPanel
              momentum={countryMomentum}
              timeseries={timeseries}
              loading={loadingDetail}
              onClose={handleClosePanel}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-4">
            <span>Data sources: FRED, yfinance, OECD SDMX</span>
            <span>·</span>
            <span>Momentum = 0.2×Level + 0.6×Trend + 0.2×Acceleration</span>
          </div>
          <div>
            Macro Momentum Index — Z-score velocity scoring
          </div>
        </div>
      </footer>
    </div>
  );
}
