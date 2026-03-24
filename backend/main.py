"""
Macro Momentum Index — FastAPI backend.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import engine, SessionLocal, Base
from models import Country, Indicator, MomentumScore, PillarScore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Starting up Macro Momentum Index backend...")

    # 1. Create DB tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified.")

    db = SessionLocal()
    try:
        # 2. Seed countries
        from seeds.seed_countries import seed_countries
        added = seed_countries(db)
        if added:
            logger.info(f"Seeded {added} countries.")

        # 3. Check if indicator data exists — backfill if not
        indicator_count = db.query(Indicator).count()
        if indicator_count == 0:
            logger.info("No indicator data found — running backfill in background...")

            async def _backfill():
                bg_db = SessionLocal()
                try:
                    from services.data_fetcher import run_full_backfill
                    from services.momentum_calculator import recalculate_all
                    await asyncio.get_event_loop().run_in_executor(None, run_full_backfill, bg_db)
                    await asyncio.get_event_loop().run_in_executor(None, recalculate_all, bg_db)
                    logger.info("Background backfill + recalculation complete.")
                except Exception as e:
                    logger.error(f"Backfill failed: {e}", exc_info=True)
                finally:
                    bg_db.close()

            asyncio.create_task(_backfill())
        else:
            logger.info(f"Found {indicator_count} indicator records — skipping backfill.")

            # Check if momentum scores exist
            score_count = db.query(MomentumScore).count()
            if score_count == 0:
                logger.info("No momentum scores found — recalculating in background...")

                async def _recalc():
                    bg_db = SessionLocal()
                    try:
                        from services.momentum_calculator import recalculate_all
                        await asyncio.get_event_loop().run_in_executor(None, recalculate_all, bg_db)
                        logger.info("Background recalculation complete.")
                    except Exception as e:
                        logger.error(f"Recalculation failed: {e}", exc_info=True)
                    finally:
                        bg_db.close()

                asyncio.create_task(_recalc())

    finally:
        db.close()

    # 4. Start scheduler
    from services.scheduler import setup_scheduler
    sched = setup_scheduler()
    sched.start()
    logger.info("Scheduler started.")

    yield

    # Shutdown
    sched.shutdown(wait=False)
    logger.info("Scheduler stopped.")


app = FastAPI(
    title="Macro Momentum Index API",
    version="1.0.0",
    description="Self-referenced macroeconomic momentum scoring for G10 economies.",
    lifespan=lifespan,
)

# CORS — allow all origins in development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from api.countries import router as countries_router
from api.momentum import router as momentum_router
from api.data import router as data_router

app.include_router(countries_router)
app.include_router(momentum_router)
app.include_router(data_router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    from sqlalchemy import text as sql_text
    db = SessionLocal()
    try:
        db.execute(sql_text("SELECT 1"))
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"
    finally:
        db.close()

    db2 = SessionLocal()
    try:
        countries_count = db2.query(Country).count()
        indicators_count = db2.query(Indicator).count()
        latest_score = (
            db2.query(MomentumScore)
            .order_by(MomentumScore.date.desc())
            .first()
        )
        return {
            "status": "ok",
            "database": db_status,
            "countries_count": countries_count,
            "indicators_count": indicators_count,
            "last_updated": latest_score.date if latest_score else None,
        }
    finally:
        db2.close()


@app.get("/")
def root():
    return {"message": "Macro Momentum Index API", "docs": "/docs"}
