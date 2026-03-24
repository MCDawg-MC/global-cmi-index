"""
Data fetcher service — fetches real data from FRED, yfinance, OECD.
Falls back to synthetic mock data when API keys are missing or unavailable.
"""

import logging
import random
import math
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from models import Country, Indicator

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

COUNTRIES = [
    {"code": "USA", "name": "United States", "region": "North America"},
    {"code": "DEU", "name": "Germany", "region": "Europe"},
    {"code": "GBR", "name": "United Kingdom", "region": "Europe"},
    {"code": "JPN", "name": "Japan", "region": "Asia Pacific"},
    {"code": "CHN", "name": "China", "region": "Asia Pacific"},
    {"code": "CAN", "name": "Canada", "region": "North America"},
    {"code": "AUS", "name": "Australia", "region": "Asia Pacific"},
    {"code": "KOR", "name": "South Korea", "region": "Asia Pacific"},
    {"code": "BRA", "name": "Brazil", "region": "Latin America"},
    {"code": "EUR", "name": "Euro Area", "region": "Europe"},
]

INDICATORS = [
    "manufacturing_pmi",
    "industrial_production_yoy",
    "retail_sales_yoy",
    "employment_change",
    "wage_growth_yoy",
    "core_cpi_yoy",
    "exports_yoy",
    "trade_balance_gdp",
    "corporate_credit_yoy",
    "fx_3mo_change",
    "equity_3mo_return",
    "sovereign_spread_10y",
]

# Realistic base parameters (mean, std) for each indicator
INDICATOR_PARAMS: Dict[str, Tuple[float, float]] = {
    "manufacturing_pmi":         (50.0, 3.0),
    "industrial_production_yoy": (2.0,  4.0),
    "retail_sales_yoy":          (3.0,  5.0),
    "employment_change":         (0.1,  0.3),
    "wage_growth_yoy":           (3.0,  2.0),
    "core_cpi_yoy":              (2.5,  1.5),
    "exports_yoy":               (3.0,  8.0),
    "trade_balance_gdp":         (0.0,  3.0),
    "corporate_credit_yoy":      (4.0,  6.0),
    "fx_3mo_change":             (0.0,  3.0),
    "equity_3mo_return":         (2.0,  8.0),
    "sovereign_spread_10y":      (1.5,  0.8),
}

# Country-specific biases to make results interesting
COUNTRY_BIASES: Dict[str, Dict[str, float]] = {
    "USA": {
        "manufacturing_pmi": 1.5, "industrial_production_yoy": 1.0,
        "retail_sales_yoy": 1.5, "employment_change": 0.05,
        "wage_growth_yoy": 0.5, "core_cpi_yoy": 0.5,
        "exports_yoy": 0.5, "trade_balance_gdp": -1.5,
        "corporate_credit_yoy": 1.0, "fx_3mo_change": 0.5,
        "equity_3mo_return": 2.0, "sovereign_spread_10y": -0.3,
    },
    "DEU": {
        "manufacturing_pmi": -2.5, "industrial_production_yoy": -2.0,
        "retail_sales_yoy": -1.0, "employment_change": 0.0,
        "wage_growth_yoy": 0.5, "core_cpi_yoy": 0.8,
        "exports_yoy": -1.0, "trade_balance_gdp": 2.0,
        "corporate_credit_yoy": -1.0, "fx_3mo_change": 0.2,
        "equity_3mo_return": -0.5, "sovereign_spread_10y": -0.5,
    },
    "GBR": {
        "manufacturing_pmi": -1.0, "industrial_production_yoy": -0.5,
        "retail_sales_yoy": -0.5, "employment_change": 0.01,
        "wage_growth_yoy": 1.5, "core_cpi_yoy": 1.5,
        "exports_yoy": -0.5, "trade_balance_gdp": -1.0,
        "corporate_credit_yoy": 0.0, "fx_3mo_change": -0.5,
        "equity_3mo_return": 0.5, "sovereign_spread_10y": 0.3,
    },
    "JPN": {
        "manufacturing_pmi": -1.0, "industrial_production_yoy": -0.5,
        "retail_sales_yoy": 0.0, "employment_change": 0.0,
        "wage_growth_yoy": -0.5, "core_cpi_yoy": -1.0,
        "exports_yoy": 0.5, "trade_balance_gdp": 0.5,
        "corporate_credit_yoy": -1.0, "fx_3mo_change": -1.5,
        "equity_3mo_return": 1.0, "sovereign_spread_10y": -1.0,
    },
    "CHN": {
        "manufacturing_pmi": 0.5, "industrial_production_yoy": 3.0,
        "retail_sales_yoy": 2.0, "employment_change": 0.05,
        "wage_growth_yoy": 2.0, "core_cpi_yoy": -1.0,
        "exports_yoy": 3.0, "trade_balance_gdp": 3.0,
        "corporate_credit_yoy": 4.0, "fx_3mo_change": -0.3,
        "equity_3mo_return": -1.0, "sovereign_spread_10y": 0.2,
    },
    "CAN": {
        "manufacturing_pmi": 0.5, "industrial_production_yoy": 0.5,
        "retail_sales_yoy": 0.5, "employment_change": 0.03,
        "wage_growth_yoy": 0.5, "core_cpi_yoy": 0.3,
        "exports_yoy": 1.0, "trade_balance_gdp": 0.5,
        "corporate_credit_yoy": 0.5, "fx_3mo_change": 0.2,
        "equity_3mo_return": 1.0, "sovereign_spread_10y": -0.2,
    },
    "AUS": {
        "manufacturing_pmi": 0.0, "industrial_production_yoy": 1.0,
        "retail_sales_yoy": 0.5, "employment_change": 0.03,
        "wage_growth_yoy": 0.8, "core_cpi_yoy": 0.5,
        "exports_yoy": 2.0, "trade_balance_gdp": 1.5,
        "corporate_credit_yoy": 0.5, "fx_3mo_change": 0.3,
        "equity_3mo_return": 0.8, "sovereign_spread_10y": -0.1,
    },
    "KOR": {
        "manufacturing_pmi": 0.5, "industrial_production_yoy": 2.0,
        "retail_sales_yoy": 0.5, "employment_change": 0.02,
        "wage_growth_yoy": 1.0, "core_cpi_yoy": 0.3,
        "exports_yoy": 3.5, "trade_balance_gdp": 2.0,
        "corporate_credit_yoy": 2.0, "fx_3mo_change": -0.5,
        "equity_3mo_return": 1.5, "sovereign_spread_10y": 0.0,
    },
    "BRA": {
        "manufacturing_pmi": -0.5, "industrial_production_yoy": -1.0,
        "retail_sales_yoy": 1.0, "employment_change": 0.02,
        "wage_growth_yoy": 3.0, "core_cpi_yoy": 3.0,
        "exports_yoy": 2.0, "trade_balance_gdp": 1.0,
        "corporate_credit_yoy": 3.0, "fx_3mo_change": -2.0,
        "equity_3mo_return": 0.0, "sovereign_spread_10y": 2.5,
    },
    "EUR": {
        "manufacturing_pmi": -1.5, "industrial_production_yoy": -1.0,
        "retail_sales_yoy": -0.5, "employment_change": 0.01,
        "wage_growth_yoy": 0.8, "core_cpi_yoy": 0.5,
        "exports_yoy": -0.5, "trade_balance_gdp": 1.0,
        "corporate_credit_yoy": -0.5, "fx_3mo_change": 0.2,
        "equity_3mo_return": 0.0, "sovereign_spread_10y": 0.2,
    },
}

# yfinance equity tickers
EQUITY_TICKERS = {
    "USA": "^GSPC",
    "DEU": "^GDAXI",
    "GBR": "^FTSE",
    "JPN": "^N225",
    "CHN": "000001.SS",
    "CAN": "^GSPTSE",
    "AUS": "^AXJO",
    "KOR": "^KS11",
    "BRA": "^BVSP",
    "EUR": "^STOXX50E",
}

FX_TICKERS = {
    "USA": None,  # USD is base
    "DEU": "EURUSD=X",
    "GBR": "GBPUSD=X",
    "JPN": "JPYUSD=X",
    "CHN": "CNYUSD=X",
    "CAN": "CADUSD=X",
    "AUS": "AUDUSD=X",
    "KOR": "KRWUSD=X",
    "BRA": "BRLUSD=X",
    "EUR": "EURUSD=X",
}


# ---------------------------------------------------------------------------
# Synthetic data generation
# ---------------------------------------------------------------------------

def _generate_ar1_series(n: int, mean: float, std: float, ar_coef: float = 0.7) -> List[float]:
    """Generate an AR(1) time series with given parameters."""
    series = []
    val = mean
    for _ in range(n):
        noise = random.gauss(0, std * math.sqrt(1 - ar_coef ** 2))
        val = mean + ar_coef * (val - mean) + noise
        series.append(round(val, 4))
    return series


def generate_mock_data(country_code: str) -> Dict[str, List[Tuple[date, float]]]:
    """
    Generate 60 months of synthetic indicator data for a country.
    Returns {indicator_name: [(date, value), ...]}
    """
    rng = random.Random(hash(country_code) % (2**31))
    biases = COUNTRY_BIASES.get(country_code, {})

    end_date = date.today().replace(day=1)
    dates = []
    d = end_date
    for _ in range(60):
        dates.append(d)
        # go back one month
        if d.month == 1:
            d = d.replace(year=d.year - 1, month=12)
        else:
            d = d.replace(month=d.month - 1)
    dates.reverse()

    result: Dict[str, List[Tuple[date, float]]] = {}

    for indicator in INDICATORS:
        base_mean, base_std = INDICATOR_PARAMS[indicator]
        bias = biases.get(indicator, 0.0)
        adjusted_mean = base_mean + bias

        # Use rng for reproducibility
        series_values = []
        val = adjusted_mean
        ar_coef = 0.7
        for _ in range(60):
            noise = rng.gauss(0, base_std * math.sqrt(1 - ar_coef ** 2))
            val = adjusted_mean + ar_coef * (val - adjusted_mean) + noise
            series_values.append(round(val, 4))

        result[indicator] = list(zip(dates, series_values))

    return result


# ---------------------------------------------------------------------------
# FRED fetcher
# ---------------------------------------------------------------------------

FRED_SERIES_MAP = {
    "industrial_production_yoy": "INDPRO",
    "retail_sales_yoy": "RSXFS",
    "employment_change": "PAYEMS",
    "wage_growth_yoy": "CES0500000003",
    "core_cpi_yoy": "CPILFESL",
    "exports_yoy": "BOPXGS",
    "trade_balance_gdp": "BOPGSTB",
    "corporate_credit_yoy": "TOTLL",
    "sovereign_spread_10y": "DGS10",
}


def fetch_fred_data(indicator: str, api_key: str) -> Optional[List[Tuple[date, float]]]:
    """Fetch data from FRED API for USA indicators."""
    try:
        from fredapi import Fred
        fred = Fred(api_key=api_key)
        series_id = FRED_SERIES_MAP.get(indicator)
        if not series_id:
            return None

        end = date.today()
        start = date(end.year - 6, end.month, 1)
        series = fred.get_series(series_id, observation_start=start.isoformat(), observation_end=end.isoformat())

        # Convert to pct change YoY where appropriate
        results = []
        for dt, val in series.items():
            if val is not None and not math.isnan(val):
                results.append((dt.date(), float(val)))

        return results if results else None
    except Exception as e:
        logger.warning(f"FRED fetch failed for {indicator}: {e}")
        return None


# ---------------------------------------------------------------------------
# yfinance fetcher
# ---------------------------------------------------------------------------

def fetch_equity_return(country_code: str) -> Optional[List[Tuple[date, float]]]:
    """Fetch 3-month equity return from yfinance."""
    try:
        import yfinance as yf
        ticker = EQUITY_TICKERS.get(country_code)
        if not ticker:
            return None

        end = date.today()
        start = date(end.year - 2, end.month, 1)
        data = yf.download(ticker, start=start.isoformat(), end=end.isoformat(), progress=False)
        if data.empty:
            return None

        monthly = data["Close"].resample("ME").last()
        results = []
        for i in range(3, len(monthly)):
            current = monthly.iloc[i]
            three_mo_ago = monthly.iloc[i - 3]
            if three_mo_ago and three_mo_ago != 0:
                ret = ((current - three_mo_ago) / three_mo_ago) * 100
                results.append((monthly.index[i].date(), round(float(ret), 4)))

        return results if results else None
    except Exception as e:
        logger.warning(f"yfinance equity fetch failed for {country_code}: {e}")
        return None


def fetch_fx_change(country_code: str) -> Optional[List[Tuple[date, float]]]:
    """Fetch 3-month FX change from yfinance."""
    try:
        import yfinance as yf
        ticker = FX_TICKERS.get(country_code)
        if not ticker:
            return None

        end = date.today()
        start = date(end.year - 2, end.month, 1)
        data = yf.download(ticker, start=start.isoformat(), end=end.isoformat(), progress=False)
        if data.empty:
            return None

        monthly = data["Close"].resample("ME").last()
        results = []
        for i in range(3, len(monthly)):
            current = monthly.iloc[i]
            three_mo_ago = monthly.iloc[i - 3]
            if three_mo_ago and three_mo_ago != 0:
                chg = ((current - three_mo_ago) / three_mo_ago) * 100
                results.append((monthly.index[i].date(), round(float(chg), 4)))

        return results if results else None
    except Exception as e:
        logger.warning(f"yfinance FX fetch failed for {country_code}: {e}")
        return None


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def fetch_and_store_country_data(country_code: str, db: Session, use_real_apis: bool = False) -> int:
    """
    Fetch data for a country and store in DB.
    Returns the number of records inserted.
    """
    from config import settings

    stored_count = 0
    mock_data = generate_mock_data(country_code)

    for indicator_name, series in mock_data.items():
        for dt, value in series:
            _upsert_indicator(db, country_code, indicator_name, dt, value, "mock", "monthly")
            stored_count += 1

    # Try real API overlays if configured
    if use_real_apis and settings.FRED_API_KEY and country_code == "USA":
        for indicator in FRED_SERIES_MAP.keys():
            real_data = fetch_fred_data(indicator, settings.FRED_API_KEY)
            if real_data:
                for dt, value in real_data:
                    _upsert_indicator(db, country_code, indicator, dt, value, "FRED", "monthly")

    if use_real_apis:
        equity_data = fetch_equity_return(country_code)
        if equity_data:
            for dt, value in equity_data:
                _upsert_indicator(db, country_code, "equity_3mo_return", dt, value, "yfinance", "monthly")

        fx_data = fetch_fx_change(country_code)
        if fx_data:
            for dt, value in fx_data:
                _upsert_indicator(db, country_code, "fx_3mo_change", dt, value, "yfinance", "monthly")

    db.commit()
    return stored_count


def _upsert_indicator(
    db: Session,
    country_code: str,
    indicator_name: str,
    dt: date,
    value: float,
    source: str,
    frequency: str,
):
    """Insert or update an indicator record."""
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import Indicator

    stmt = pg_insert(Indicator).values(
        country_code=country_code,
        indicator_name=indicator_name,
        date=dt,
        value=value,
        source=source,
        frequency=frequency,
    ).on_conflict_do_update(
        index_elements=["country_code", "indicator_name", "date"],
        set_={"value": value, "source": source},
    )
    db.execute(stmt)


def run_full_backfill(db: Session):
    """Generate 5 years of mock data for all countries."""
    logger.info("Starting full backfill with synthetic data...")
    for country in COUNTRIES:
        code = country["code"]
        logger.info(f"Backfilling {code}...")
        count = fetch_and_store_country_data(code, db, use_real_apis=False)
        logger.info(f"  Stored {count} records for {code}")
    logger.info("Backfill complete.")


def refresh_market_data(db: Session):
    """Refresh daily market data (FX, equity). Called by scheduler."""
    from config import settings
    use_real = bool(settings.FRED_API_KEY)
    for country in COUNTRIES:
        if use_real:
            equity_data = fetch_equity_return(country["code"])
            if equity_data and equity_data:
                dt, val = equity_data[-1]
                _upsert_indicator(db, country["code"], "equity_3mo_return", dt, val, "yfinance", "monthly")
            fx_data = fetch_fx_change(country["code"])
            if fx_data and fx_data:
                dt, val = fx_data[-1]
                _upsert_indicator(db, country["code"], "fx_3mo_change", dt, val, "yfinance", "monthly")
    db.commit()


def refresh_monthly_data(db: Session):
    """Refresh monthly indicator data. Called by scheduler."""
    for country in COUNTRIES:
        fetch_and_store_country_data(country["code"], db, use_real_apis=True)
