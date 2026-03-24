"""Seed the countries table with initial data."""

from sqlalchemy.orm import Session
from models import Country


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


def seed_countries(db: Session):
    """Insert countries if not already present."""
    existing = {c.code for c in db.query(Country).all()}
    added = 0
    for country_data in COUNTRIES:
        if country_data["code"] not in existing:
            db.add(Country(**country_data, historical_stats={}))
            added += 1
    if added > 0:
        db.commit()
    return added
