"""Countries API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Country, MomentumScore
from schemas import CountryWithMomentum

router = APIRouter(prefix="/api/countries", tags=["countries"])


@router.get("", response_model=List[CountryWithMomentum])
def get_countries(db: Session = Depends(get_db)):
    """List all countries with their latest momentum scores."""
    countries = db.query(Country).all()
    if not countries:
        raise HTTPException(status_code=404, detail="No countries found")

    result = []
    for country in countries:
        # Get latest momentum score
        latest = (
            db.query(MomentumScore)
            .filter(MomentumScore.country_code == country.code)
            .order_by(MomentumScore.date.desc())
            .first()
        )

        result.append(
            CountryWithMomentum(
                code=country.code,
                name=country.name,
                region=country.region,
                momentum_score=latest.momentum_score if latest else None,
                momentum_category=latest.momentum_category if latest else None,
                global_rank=latest.global_rank if latest else None,
                momentum_change_1m=latest.momentum_change_1m if latest else None,
                data_completeness=latest.data_completeness if latest else None,
            )
        )

    # Sort by rank (nulls last)
    result.sort(key=lambda x: (x.global_rank is None, x.global_rank or 999))
    return result
