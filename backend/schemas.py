from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import date


class CountryBase(BaseModel):
    code: str
    name: str
    region: str


class CountryWithMomentum(CountryBase):
    momentum_score: Optional[float] = None
    momentum_category: Optional[str] = None
    global_rank: Optional[int] = None
    momentum_change_1m: Optional[float] = None
    data_completeness: Optional[float] = None

    class Config:
        from_attributes = True


class IndicatorDetail(BaseModel):
    name: str
    value: Optional[float] = None
    level_score: Optional[float] = None
    trend_score: Optional[float] = None
    accel_score: Optional[float] = None
    momentum: Optional[float] = None


class PillarDetail(BaseModel):
    name: str
    weight: float
    score: Optional[float] = None
    contribution: Optional[float] = None
    indicators: List[IndicatorDetail] = []


class MomentumChanges(BaseModel):
    field_1m: Optional[float] = None
    field_3m: Optional[float] = None
    field_6m: Optional[float] = None

    class Config:
        populate_by_name = True


class CountryMomentumResponse(BaseModel):
    country: CountryWithMomentum
    latest_score: Optional[float] = None
    momentum_category: Optional[str] = None
    pillars: List[PillarDetail] = []
    changes: Dict[str, Optional[float]] = {}


class TimeseriesPoint(BaseModel):
    date: date
    momentum_score: Optional[float] = None
    fx_capital: Optional[float] = None
    domestic_demand: Optional[float] = None
    industrial: Optional[float] = None
    trade: Optional[float] = None
    labor: Optional[float] = None
    credit: Optional[float] = None
    market_sentiment: Optional[float] = None
    inflation: Optional[float] = None

    class Config:
        from_attributes = True


class CompareCountryData(BaseModel):
    country: CountryWithMomentum
    latest_score: Optional[float] = None
    pillars: List[PillarDetail] = []
    timeseries: List[TimeseriesPoint] = []


class HealthResponse(BaseModel):
    status: str
    database: str
    countries_count: int
    indicators_count: int
    last_updated: Optional[date] = None
