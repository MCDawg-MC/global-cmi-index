from sqlalchemy import Column, String, Integer, Float, Date, ForeignKey, JSON, UniqueConstraint
from database import Base


class Country(Base):
    __tablename__ = "countries"

    code = Column(String(3), primary_key=True)
    name = Column(String(100))
    region = Column(String(50))
    historical_stats = Column(JSON, default={})


class Indicator(Base):
    __tablename__ = "indicators"

    id = Column(Integer, primary_key=True)
    country_code = Column(String(3), ForeignKey("countries.code"))
    indicator_name = Column(String(50))
    date = Column(Date)
    value = Column(Float)
    source = Column(String(50))
    frequency = Column(String(10))

    __table_args__ = (
        UniqueConstraint("country_code", "indicator_name", "date"),
    )


class PillarScore(Base):
    __tablename__ = "pillar_scores"

    id = Column(Integer, primary_key=True)
    country_code = Column(String(3), ForeignKey("countries.code"))
    date = Column(Date)
    pillar_name = Column(String(30))
    level_score = Column(Float)
    trend_score = Column(Float)
    acceleration_score = Column(Float)
    momentum_score = Column(Float)

    __table_args__ = (
        UniqueConstraint("country_code", "pillar_name", "date"),
    )


class MomentumScore(Base):
    __tablename__ = "momentum_scores"

    id = Column(Integer, primary_key=True)
    country_code = Column(String(3), ForeignKey("countries.code"))
    date = Column(Date)
    momentum_score = Column(Float)
    fx_capital = Column(Float)
    domestic_demand = Column(Float)
    industrial = Column(Float)
    trade = Column(Float)
    labor = Column(Float)
    credit = Column(Float)
    market_sentiment = Column(Float)
    inflation = Column(Float)
    momentum_category = Column(String(30))
    momentum_change_1m = Column(Float)
    momentum_change_3m = Column(Float)
    momentum_change_6m = Column(Float)
    global_rank = Column(Integer)
    data_completeness = Column(Float)

    __table_args__ = (
        UniqueConstraint("country_code", "date"),
    )
