import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Tooltip } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Country } from '../types';

interface WorldMapProps {
  countries: Country[];
  onCountryClick: (code: string) => void;
  selectedCode: string | null;
}

// Map our 3-letter codes to GeoJSON ISO_A3 codes
const CODE_MAP: Record<string, string> = {
  USA: 'USA',
  DEU: 'DEU',
  GBR: 'GBR',
  JPN: 'JPN',
  CHN: 'CHN',
  CAN: 'CAN',
  AUS: 'AUS',
  KOR: 'KOR',
  BRA: 'BRA',
  EUR: 'EUR', // Euro Area — handled specially
};

// Euro Area ISO_A3 codes for member countries we want to highlight
const EURO_AREA_CODES = new Set([
  'AUT', 'BEL', 'CYP', 'EST', 'FIN', 'FRA', 'DEU', 'GRC',
  'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'PRT',
  'SVK', 'SVN', 'ESP',
]);

function getMomentumColor(score: number | null, isSelected: boolean): string {
  const alpha = isSelected ? 'cc' : '99';
  if (score === null) return `#334155${alpha}`;
  if (score >= 2.0) return `#059669${alpha}`;
  if (score >= 1.0) return `#10B981${alpha}`;
  if (score >= -1.0) return `#FCD34D${alpha}`;
  if (score >= -2.0) return `#F59E0B${alpha}`;
  return `#DC2626${alpha}`;
}

const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

export default function WorldMap({ countries, onCountryClick, selectedCode }: WorldMapProps) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Build lookup by ISO_A3 code
  const countryMap = React.useMemo(() => {
    const map: Record<string, Country> = {};
    for (const c of countries) {
      if (c.code === 'EUR') continue; // handled separately
      const iso = CODE_MAP[c.code];
      if (iso) map[iso] = c;
    }
    return map;
  }, [countries]);

  const euroAreaData = countries.find((c) => c.code === 'EUR');

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const styleFeature = (feature: any): PathOptions => {
    const iso = feature?.properties?.ISO_A3;
    const country = countryMap[iso];

    // Euro area overlay
    if (!country && EURO_AREA_CODES.has(iso) && euroAreaData) {
      const isSelected = selectedCode === 'EUR';
      return {
        fillColor: getMomentumColor(euroAreaData.momentum_score, isSelected),
        weight: isSelected ? 2 : 1,
        color: isSelected ? '#38bdf8' : '#0f172a',
        fillOpacity: 0.8,
      };
    }

    if (!country) {
      return {
        fillColor: '#1e293b',
        weight: 0.5,
        color: '#0f172a',
        fillOpacity: 0.5,
      };
    }

    const isSelected = selectedCode === country.code;
    return {
      fillColor: getMomentumColor(country.momentum_score, isSelected),
      weight: isSelected ? 2.5 : 1,
      color: isSelected ? '#38bdf8' : '#0f172a',
      fillOpacity: 0.85,
    };
  };

  const onEachFeature = (feature: any, layer: Layer) => {
    const iso = feature?.properties?.ISO_A3;
    const country = countryMap[iso];
    const isEuro = EURO_AREA_CODES.has(iso) && euroAreaData;

    const targetCountry = country || (isEuro ? euroAreaData : null);
    const targetCode = country ? country.code : isEuro ? 'EUR' : null;

    if (targetCountry) {
      const score = targetCountry.momentum_score;
      const category = targetCountry.momentum_category || 'N/A';
      const rank = targetCountry.global_rank;

      (layer as any).bindTooltip(
        `<div style="background:#1e293b;border:1px solid #334155;padding:8px 12px;border-radius:6px;min-width:160px;">
          <div style="font-weight:600;font-size:13px;color:#f1f5f9;margin-bottom:4px;">${targetCountry.name}</div>
          <div style="font-size:12px;color:#94a3b8;">
            Score: <span style="color:#f1f5f9;font-weight:500;">${score !== null ? score.toFixed(2) : 'N/A'}</span>
          </div>
          <div style="font-size:12px;color:#94a3b8;">${category}</div>
          ${rank !== null ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">Rank #${rank}</div>` : ''}
        </div>`,
        { sticky: true, className: 'momentum-tooltip', opacity: 1 }
      );

      layer.on({
        click: () => {
          if (targetCode) onCountryClick(targetCode);
        },
        mouseover: (e: any) => {
          e.target.setStyle({ weight: 2.5, color: '#38bdf8' });
        },
        mouseout: (e: any) => {
          e.target.setStyle(styleFeature(feature));
        },
      });
    }
  };

  return (
    <div className="relative w-full" style={{ height: '60vh' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 z-10">
          <div className="text-slate-400 text-sm">Loading map...</div>
        </div>
      )}
      <MapContainer
        center={[20, 10]}
        zoom={2}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
        scrollWheelZoom={true}
        worldCopyJump={false}
        maxBoundsViscosity={1.0}
      >
        {/* Dark tile layer */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        {geoData && (
          <GeoJSON
            key={`${selectedCode}-${countries.map((c) => c.momentum_score).join(',')}`}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/90 backdrop-blur rounded-lg border border-slate-700 p-3">
        <div className="text-xs font-medium text-slate-400 mb-2">Momentum Score</div>
        <div className="flex flex-col gap-1">
          {[
            { color: '#059669', label: '≥ 2.0  Strongly Accelerating' },
            { color: '#10B981', label: '1.0 to 2.0  Accelerating' },
            { color: '#FCD34D', label: '-1.0 to 1.0  Stable' },
            { color: '#F59E0B', label: '-2.0 to -1.0  Decelerating' },
            { color: '#DC2626', label: '≤ -2.0  Strongly Decelerating' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
