"""Momentum API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from database import get_db
from models import Country, MomentumScore, PillarScore, Indicator
from schemas import (
    CountryMomentumResponse,
    CountryWithMomentum,
    PillarDetail,
    IndicatorDetail,
    TimeseriesPoint,
    CompareCountryData,
)
from services.momentum_calculator import (
    PILLAR_WEIGHTS,
    PILLAR_INDICATORS,
    calculate_pillar_scores,
)

router = APIRouter(prefix="/api/momentum", tags=["momentum"])


def _build_country_momentum(country_code: str, db: Session) -> CountryMomentumResponse:
    """Build full momentum breakdown for a country."""
    country = db.query(Country).filter(Country.code == country_code).first()
    if not country:
        raise HTTPException(status_code=404, detail=f"Country {country_code} not found")

    latest_score_row = (
        db.query(MomentumScore)
        .filter(MomentumScore.country_code == country_code)
        .order_by(MomentumScore.date.desc())
        .first()
    )

    latest_date = latest_score_row.date if latest_score_row else date.today().replace(day=1)

    country_out = CountryWithMomentum(
        code=country.code,
        name=country.name,
        region=country.region,
        momentum_score=latest_score_row.momentum_score if latest_score_row else None,
        momentum_category=latest_score_row.momentum_category if latest_score_row else None,
        global_rank=latest_score_row.global_rank if latest_score_row else None,
        momentum_change_1m=latest_score_row.momentum_change_1m if latest_score_row else None,
        data_completeness=latest_score_row.data_completeness if latest_score_row else None,
    )

    # Get pillar scores from DB
    pillar_rows = (
        db.query(PillarScore)
        .filter(
            PillarScore.country_code == country_code,
            PillarScore.date == latest_date,
        )
        .all()
    )
    pillar_score_map = {row.pillar_name: row for row in pillar_rows}

    # Get latest indicator values and scores
    pillar_details = []
    for pillar_name, indicator_names in PILLAR_INDICATORS.items():
        weight = PILLAR_WEIGHTS[pillar_name]
        pillar_row = pillar_score_map.get(pillar_name)
        pillar_score = pillar_row.momentum_score if pillar_row else None
        contribution = round(pillar_score * weight, 4) if pillar_score is not None else None

        # Fetch indicator details
        indicator_details = []
        for ind_name in indicator_names:
            ind_rows = (
                db.query(Indicator)
                .filter(
                    Indicator.country_code == country_code,
                    Indicator.indicator_name == ind_name,
                    Indicator.date <= latest_date,
                )
                .order_by(Indicator.date.desc())
                .limit(60)
                .all()
            )

            if not ind_rows:
                indicator_details.append(IndicatorDetail(name=ind_name))
                continue

            ind_rows_sorted = sorted(ind_rows, key=lambda r: r.date)
            values = [r.value for r in ind_rows_sorted]
            dates_list = [r.date for r in ind_rows_sorted]

            from services.momentum_calculator import calculate_indicator_momentum, LOWER_IS_BETTER
            result = calculate_indicator_momentum(values, dates_list)
            momentum_val = result.get("momentum_score")
            if momentum_val is not None and ind_name in LOWER_IS_BETTER:
                momentum_val = -momentum_val

            indicator_details.append(
                IndicatorDetail(
                    name=ind_name,
                    value=round(values[-1], 4) if values else None,
                    level_score=result.get("level_score"),
                    trend_score=result.get("trend_score"),
                    accel_score=result.get("accel_score"),
                    momentum=momentum_val,
                )
            )

        pillar_details.append(
            PillarDetail(
                name=pillar_name,
                weight=weight,
                score=pillar_score,
                contribution=contribution,
                indicators=indicator_details,
            )
        )

    changes = {
        "1m": latest_score_row.momentum_change_1m if latest_score_row else None,
        "3m": latest_score_row.momentum_change_3m if latest_score_row else None,
        "6m": latest_score_row.momentum_change_6m if latest_score_row else None,
    }

    return CountryMomentumResponse(
        country=country_out,
        latest_score=latest_score_row.momentum_score if latest_score_row else None,
        momentum_category=latest_score_row.momentum_category if latest_score_row else None,
        pillars=pillar_details,
        changes=changes,
    )


@router.get("/timeseries/{country_code}", response_model=List[TimeseriesPoint])
def get_timeseries(country_code: str, db: Session = Depends(get_db)):
    """Get 12-month momentum timeseries for a country."""
    code = country_code.upper()
    country = db.query(Country).filter(Country.code == code).first()
    if not country:
        raise HTTPException(status_code=404, detail=f"Country {code} not found")

    rows = (
        db.query(MomentumScore)
        .filter(MomentumScore.country_code == code)
        .order_by(MomentumScore.date.desc())
        .limit(13)
        .all()
    )

    rows.sort(key=lambda r: r.date)
    return [
        TimeseriesPoint(
            date=row.date,
            momentum_score=row.momentum_score,
            fx_capital=row.fx_capital,
            domestic_demand=row.domestic_demand,
            industrial=row.industrial,
            trade=row.trade,
            labor=row.labor,
            credit=row.credit,
            market_sentiment=row.market_sentiment,
            inflation=row.inflation,
        )
        for row in rows
    ]


@router.get("/compare", response_model=List[CompareCountryData])
def compare_countries(
    countries: str = Query(..., description="Comma-separated country codes, max 4"),
    db: Session = Depends(get_db),
):
    """Compare momentum data for multiple countries."""
    codes = [c.strip().upper() for c in countries.split(",")][:4]
    result = []

    for code in codes:
        try:
            momentum_data = _build_country_momentum(code, db)
        except HTTPException:
            continue

        timeseries = (
            db.query(MomentumScore)
            .filter(MomentumScore.country_code == code)
            .order_by(MomentumScore.date.desc())
            .limit(13)
            .all()
        )
        timeseries.sort(key=lambda r: r.date)
        ts_points = [
            TimeseriesPoint(
                date=row.date,
                momentum_score=row.momentum_score,
                fx_capital=row.fx_capital,
                domestic_demand=row.domestic_demand,
                industrial=row.industrial,
                trade=row.trade,
                labor=row.labor,
                credit=row.credit,
                market_sentiment=row.market_sentiment,
                inflation=row.inflation,
            )
            for row in timeseries
        ]

        result.append(
            CompareCountryData(
                country=momentum_data.country,
                latest_score=momentum_data.latest_score,
                pillars=momentum_data.pillars,
                timeseries=ts_points,
            )
        )

    return result


@router.get("/{country_code}", response_model=CountryMomentumResponse)
def get_country_momentum(country_code: str, db: Session = Depends(get_db)):
    """Get full momentum breakdown for a country."""
    return _build_country_momentum(country_code.upper(), db)
