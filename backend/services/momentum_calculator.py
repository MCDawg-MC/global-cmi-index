"""
Momentum calculator — implements the self-referenced Z-score velocity formula.
"""

import logging
import math
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PILLAR_WEIGHTS = {
    "fx_capital":       0.20,
    "domestic_demand":  0.18,
    "industrial":       0.16,
    "trade":            0.14,
    "labor":            0.12,
    "credit":           0.10,
    "market_sentiment": 0.10,
    "inflation":        0.08,
}

PILLAR_INDICATORS: Dict[str, List[str]] = {
    "fx_capital":       ["fx_3mo_change"],
    "domestic_demand":  ["retail_sales_yoy"],
    "industrial":       ["manufacturing_pmi", "industrial_production_yoy"],
    "trade":            ["exports_yoy", "trade_balance_gdp"],
    "labor":            ["employment_change", "wage_growth_yoy"],
    "credit":           ["corporate_credit_yoy"],
    "market_sentiment": ["equity_3mo_return", "sovereign_spread_10y"],
    "inflation":        ["core_cpi_yoy"],
}

# Indicators where lower is better (score is inverted)
LOWER_IS_BETTER = {"core_cpi_yoy", "sovereign_spread_10y"}

# Equal weights within pillar for now
INDICATOR_WEIGHTS: Dict[str, Dict[str, float]] = {
    "fx_capital":       {"fx_3mo_change": 1.0},
    "domestic_demand":  {"retail_sales_yoy": 1.0},
    "industrial":       {"manufacturing_pmi": 0.5, "industrial_production_yoy": 0.5},
    "trade":            {"exports_yoy": 0.5, "trade_balance_gdp": 0.5},
    "labor":            {"employment_change": 0.5, "wage_growth_yoy": 0.5},
    "credit":           {"corporate_credit_yoy": 1.0},
    "market_sentiment": {"equity_3mo_return": 0.5, "sovereign_spread_10y": 0.5},
    "inflation":        {"core_cpi_yoy": 1.0},
}


def _momentum_category(score: float) -> str:
    if score >= 2.0:
        return "Strongly Accelerating"
    elif score >= 1.0:
        return "Accelerating"
    elif score >= -1.0:
        return "Stable"
    elif score >= -2.0:
        return "Decelerating"
    else:
        return "Strongly Decelerating"


def _safe_div(a: float, b: float, fallback: float = 0.0) -> float:
    if b == 0 or math.isnan(b) or math.isinf(b):
        return fallback
    return a / b


# ---------------------------------------------------------------------------
# Core calculation
# ---------------------------------------------------------------------------

def calculate_indicator_momentum(
    values: List[float],
    dates: List[date],
) -> Dict:
    """
    Calculate momentum for a single indicator time series.

    Uses last 60 data points for historical stats.
    Returns dict with level_score, trend_score, accel_score, momentum_score.
    """
    if len(values) < 13:  # Need at least 13 months for 12mo lookback
        return {
            "level_score": None,
            "trend_score": None,
            "accel_score": None,
            "momentum_score": None,
        }

    # Sort by date ascending
    paired = sorted(zip(dates, values), key=lambda x: x[0])
    sorted_dates, sorted_values = zip(*paired)

    # Use last 60 months for historical stats
    hist_values = list(sorted_values[-60:])
    hist_mean = sum(hist_values) / len(hist_values)
    variance = sum((v - hist_mean) ** 2 for v in hist_values) / len(hist_values)
    hist_std = math.sqrt(variance) if variance > 0 else 1.0

    current = sorted_values[-1]

    # Find value ~6 months ago (index -7 to handle monthly data)
    idx_6mo = max(0, len(sorted_values) - 7)
    value_6mo_ago = sorted_values[idx_6mo]

    # Find value ~12 months ago
    idx_12mo = max(0, len(sorted_values) - 13)
    value_12mo_ago = sorted_values[idx_12mo]

    level_score = _safe_div(current - hist_mean, hist_std)
    trend_score = _safe_div(current - value_6mo_ago, hist_std)
    accel_score = _safe_div(
        (current - value_6mo_ago) - (value_6mo_ago - value_12mo_ago),
        hist_std,
    )

    momentum = 0.2 * level_score + 0.6 * trend_score + 0.2 * accel_score

    return {
        "level_score": round(level_score, 4),
        "trend_score": round(trend_score, 4),
        "accel_score": round(accel_score, 4),
        "momentum_score": round(momentum, 4),
        "current_value": current,
        "hist_mean": hist_mean,
        "hist_std": hist_std,
    }


def _get_indicator_series(
    country_code: str,
    indicator_name: str,
    db: Session,
    as_of_date: date,
    lookback_months: int = 72,
) -> Tuple[List[date], List[float]]:
    """Fetch indicator time series from DB."""
    from models import Indicator

    cutoff = date(as_of_date.year - (lookback_months // 12 + 1), as_of_date.month, 1)
    rows = (
        db.query(Indicator)
        .filter(
            and_(
                Indicator.country_code == country_code,
                Indicator.indicator_name == indicator_name,
                Indicator.date <= as_of_date,
                Indicator.date >= cutoff,
            )
        )
        .order_by(Indicator.date)
        .all()
    )

    dates = [r.date for r in rows]
    values = [r.value for r in rows]
    return dates, values


def calculate_pillar_scores(
    country_code: str,
    db: Session,
    calc_date: date,
) -> Dict[str, Dict]:
    """Calculate all 8 pillar scores for a country on a given date."""
    pillar_results = {}

    for pillar_name, indicators in PILLAR_INDICATORS.items():
        indicator_scores = []
        indicator_weights_in_pillar = INDICATOR_WEIGHTS[pillar_name]
        total_weight = 0.0
        weighted_momentum = 0.0
        weighted_level = 0.0
        weighted_trend = 0.0
        weighted_accel = 0.0
        indicator_details = []

        for ind_name in indicators:
            dates, values = _get_indicator_series(country_code, ind_name, db, calc_date)
            if len(values) < 13:
                indicator_details.append({
                    "name": ind_name,
                    "value": None,
                    "level_score": None,
                    "trend_score": None,
                    "accel_score": None,
                    "momentum": None,
                })
                continue

            result = calculate_indicator_momentum(values, dates)
            if result["momentum_score"] is None:
                indicator_details.append({
                    "name": ind_name,
                    "value": values[-1] if values else None,
                    "level_score": None,
                    "trend_score": None,
                    "accel_score": None,
                    "momentum": None,
                })
                continue

            momentum = result["momentum_score"]
            if ind_name in LOWER_IS_BETTER:
                momentum = -momentum
                result["momentum_score"] = momentum

            w = indicator_weights_in_pillar.get(ind_name, 1.0)
            total_weight += w
            weighted_momentum += w * momentum
            weighted_level += w * (result["level_score"] or 0)
            weighted_trend += w * (result["trend_score"] or 0)
            weighted_accel += w * (result["accel_score"] or 0)

            indicator_details.append({
                "name": ind_name,
                "value": result.get("current_value"),
                "level_score": result["level_score"],
                "trend_score": result["trend_score"],
                "accel_score": result["accel_score"],
                "momentum": momentum,
            })

        if total_weight == 0:
            pillar_results[pillar_name] = {
                "pillar_name": pillar_name,
                "momentum_score": None,
                "level_score": None,
                "trend_score": None,
                "accel_score": None,
                "indicators": indicator_details,
                "data_completeness": 0.0,
            }
        else:
            # Reweight if some indicators missing
            pillar_momentum = weighted_momentum / total_weight
            pillar_level = weighted_level / total_weight
            pillar_trend = weighted_trend / total_weight
            pillar_accel = weighted_accel / total_weight

            expected_weight = sum(indicator_weights_in_pillar.values())
            completeness = total_weight / expected_weight if expected_weight > 0 else 1.0

            pillar_results[pillar_name] = {
                "pillar_name": pillar_name,
                "momentum_score": round(pillar_momentum, 4),
                "level_score": round(pillar_level, 4),
                "trend_score": round(pillar_trend, 4),
                "accel_score": round(pillar_accel, 4),
                "indicators": indicator_details,
                "data_completeness": round(completeness, 4),
            }

    return pillar_results


def calculate_country_momentum(
    country_code: str,
    db: Session,
    calc_date: date,
) -> Optional[float]:
    """Calculate final weighted momentum score for a country."""
    pillar_scores = calculate_pillar_scores(country_code, db, calc_date)

    total_weight = 0.0
    weighted_sum = 0.0
    total_completeness = 0.0
    num_pillars = 0

    for pillar_name, pillar_data in pillar_scores.items():
        score = pillar_data.get("momentum_score")
        if score is None:
            continue
        weight = PILLAR_WEIGHTS[pillar_name]
        total_weight += weight
        weighted_sum += weight * score
        total_completeness += pillar_data.get("data_completeness", 1.0)
        num_pillars += 1

    if total_weight == 0:
        return None

    final_score = weighted_sum / total_weight
    return round(final_score, 4)


def _store_pillar_scores(country_code: str, calc_date: date, pillar_scores: Dict, db: Session):
    """Upsert pillar scores into DB."""
    from models import PillarScore
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    for pillar_name, data in pillar_scores.items():
        if data.get("momentum_score") is None:
            continue
        stmt = pg_insert(PillarScore).values(
            country_code=country_code,
            date=calc_date,
            pillar_name=pillar_name,
            level_score=data.get("level_score"),
            trend_score=data.get("trend_score"),
            acceleration_score=data.get("accel_score"),
            momentum_score=data.get("momentum_score"),
        ).on_conflict_do_update(
            index_elements=["country_code", "pillar_name", "date"],
            set_={
                "level_score": data.get("level_score"),
                "trend_score": data.get("trend_score"),
                "acceleration_score": data.get("accel_score"),
                "momentum_score": data.get("momentum_score"),
            },
        )
        db.execute(stmt)


def _get_momentum_on_date(country_code: str, target_date: date, db: Session) -> Optional[float]:
    """Get stored momentum score for a date, or calculate if missing."""
    from models import MomentumScore
    row = db.query(MomentumScore).filter(
        MomentumScore.country_code == country_code,
        MomentumScore.date == target_date,
    ).first()
    return row.momentum_score if row else None


def recalculate_all(db: Session):
    """Recalculate momentum for all countries for the last 12 months."""
    from models import Country, MomentumScore
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from services.data_fetcher import COUNTRIES

    logger.info("Starting full momentum recalculation...")
    today = date.today()

    # Build list of monthly dates for last 12 months
    calc_dates = []
    d = today.replace(day=1)
    for _ in range(13):
        calc_dates.append(d)
        if d.month == 1:
            d = d.replace(year=d.year - 1, month=12)
        else:
            d = d.replace(month=d.month - 1)
    calc_dates.reverse()

    # First pass: compute raw scores for all countries/dates
    all_scores: Dict[str, Dict[date, float]] = {}
    all_pillar_data: Dict[str, Dict[date, Dict]] = {}

    for country in COUNTRIES:
        code = country["code"]
        all_scores[code] = {}
        all_pillar_data[code] = {}
        for calc_date in calc_dates:
            pillar_scores = calculate_pillar_scores(code, db, calc_date)
            _store_pillar_scores(code, calc_date, pillar_scores, db)
            all_pillar_data[code][calc_date] = pillar_scores

            # Compute final weighted score
            total_weight = 0.0
            weighted_sum = 0.0
            total_completeness = 0.0
            num_pillars = 0
            pillar_row = {}

            for pillar_name, pdata in pillar_scores.items():
                score = pdata.get("momentum_score")
                pillar_row[pillar_name] = score
                if score is None:
                    continue
                w = PILLAR_WEIGHTS[pillar_name]
                total_weight += w
                weighted_sum += w * score
                total_completeness += pdata.get("data_completeness", 1.0)
                num_pillars += 1

            if total_weight == 0:
                continue

            final_score = round(weighted_sum / total_weight, 4)
            avg_completeness = round(total_completeness / max(num_pillars, 1), 4)
            all_scores[code][calc_date] = final_score

            all_pillar_data[code][calc_date]["_final_score"] = final_score
            all_pillar_data[code][calc_date]["_pillar_row"] = pillar_row
            all_pillar_data[code][calc_date]["_completeness"] = avg_completeness

    db.flush()

    # Second pass: compute global ranks and momentum changes, store
    for calc_date in calc_dates:
        # Collect scores for this date for ranking
        date_scores = {
            code: all_scores[code].get(calc_date)
            for code in all_scores
            if all_scores[code].get(calc_date) is not None
        }
        sorted_codes = sorted(date_scores, key=lambda c: date_scores[c], reverse=True)
        ranks = {code: i + 1 for i, code in enumerate(sorted_codes)}

        for country in COUNTRIES:
            code = country["code"]
            pdata_map = all_pillar_data[code].get(calc_date, {})
            final_score = pdata_map.get("_final_score")
            if final_score is None:
                continue

            pillar_row = pdata_map.get("_pillar_row", {})
            completeness = pdata_map.get("_completeness", 1.0)

            # Changes
            def _change(months_back: int) -> Optional[float]:
                target = calc_date
                for _ in range(months_back):
                    if target.month == 1:
                        target = target.replace(year=target.year - 1, month=12)
                    else:
                        target = target.replace(month=target.month - 1)
                past_score = all_scores[code].get(target)
                if past_score is not None:
                    return round(final_score - past_score, 4)
                return None

            stmt = pg_insert(MomentumScore).values(
                country_code=code,
                date=calc_date,
                momentum_score=final_score,
                fx_capital=pillar_row.get("fx_capital"),
                domestic_demand=pillar_row.get("domestic_demand"),
                industrial=pillar_row.get("industrial"),
                trade=pillar_row.get("trade"),
                labor=pillar_row.get("labor"),
                credit=pillar_row.get("credit"),
                market_sentiment=pillar_row.get("market_sentiment"),
                inflation=pillar_row.get("inflation"),
                momentum_category=_momentum_category(final_score),
                momentum_change_1m=_change(1),
                momentum_change_3m=_change(3),
                momentum_change_6m=_change(6),
                global_rank=ranks.get(code),
                data_completeness=completeness,
            ).on_conflict_do_update(
                index_elements=["country_code", "date"],
                set_={
                    "momentum_score": final_score,
                    "fx_capital": pillar_row.get("fx_capital"),
                    "domestic_demand": pillar_row.get("domestic_demand"),
                    "industrial": pillar_row.get("industrial"),
                    "trade": pillar_row.get("trade"),
                    "labor": pillar_row.get("labor"),
                    "credit": pillar_row.get("credit"),
                    "market_sentiment": pillar_row.get("market_sentiment"),
                    "inflation": pillar_row.get("inflation"),
                    "momentum_category": _momentum_category(final_score),
                    "momentum_change_1m": _change(1),
                    "momentum_change_3m": _change(3),
                    "momentum_change_6m": _change(6),
                    "global_rank": ranks.get(code),
                    "data_completeness": completeness,
                },
            )
            db.execute(stmt)

    db.commit()
    logger.info("Momentum recalculation complete.")
