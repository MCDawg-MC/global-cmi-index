"""Data management endpoints."""

import asyncio
import logging
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from models import Country, Indicator, MomentumScore

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/data", tags=["data"])


def _do_full_refresh(db: Session):
    """Run full data refresh and recalculation."""
    from services.data_fetcher import run_full_backfill
    from services.momentum_calculator import recalculate_all
    logger.info("Starting manual data refresh...")
    run_full_backfill(db)
    recalculate_all(db)
    logger.info("Manual data refresh complete.")


@router.post("/update")
def trigger_data_update(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Trigger a full data refresh and momentum recalculation."""
    background_tasks.add_task(_do_full_refresh, db)
    return {"status": "accepted", "message": "Data refresh started in background"}


@router.get("/status")
def get_data_status(db: Session = Depends(get_db)):
    """Get data status — counts, last updated."""
    from sqlalchemy import func
    from datetime import date

    indicator_count = db.query(func.count(Indicator.id)).scalar()
    score_count = db.query(func.count(MomentumScore.id)).scalar()

    latest = (
        db.query(MomentumScore)
        .order_by(MomentumScore.date.desc())
        .first()
    )

    return {
        "indicator_records": indicator_count,
        "momentum_score_records": score_count,
        "last_updated": latest.date if latest else None,
    }
