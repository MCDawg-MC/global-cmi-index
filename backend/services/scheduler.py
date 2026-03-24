"""
APScheduler-based task scheduler for periodic data updates.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler():
    """Register all scheduled jobs and return the scheduler (not yet started)."""

    @scheduler.scheduled_job("cron", hour=8, minute=0, id="daily_market_update")
    async def daily_market_update():
        """Daily 08:00 UTC — refresh FX and equity data."""
        logger.info("Running daily market update...")
        try:
            from database import SessionLocal
            from services.data_fetcher import refresh_market_data
            db = SessionLocal()
            try:
                refresh_market_data(db)
                logger.info("Daily market update complete.")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Daily market update failed: {e}")

    @scheduler.scheduled_job("cron", day=15, hour=10, minute=0, id="monthly_data_update")
    async def monthly_data_update():
        """15th of month 10:00 UTC — refresh monthly indicators."""
        logger.info("Running monthly data update...")
        try:
            from database import SessionLocal
            from services.data_fetcher import refresh_monthly_data
            db = SessionLocal()
            try:
                refresh_monthly_data(db)
                logger.info("Monthly data update complete.")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Monthly data update failed: {e}")

    @scheduler.scheduled_job("cron", day=16, hour=0, minute=0, id="monthly_recalculation")
    async def monthly_recalculation():
        """16th of month 00:00 UTC — recalculate all momentum scores."""
        logger.info("Running monthly momentum recalculation...")
        try:
            from database import SessionLocal
            from services.momentum_calculator import recalculate_all
            db = SessionLocal()
            try:
                recalculate_all(db)
                logger.info("Monthly recalculation complete.")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Monthly recalculation failed: {e}")

    return scheduler
