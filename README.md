# Macro Momentum Index

A full-stack web application for tracking self-referenced macroeconomic momentum across 10 major economies.

## Concept

Momentum = self-referenced Z-score velocity (NOT cross-country ranking).

Formula: `momentum = 0.2*level + 0.6*trend + 0.2*acceleration`
- `level_score = (current - hist_mean) / hist_std`
- `trend_score = (current - value_6mo_ago) / hist_std`
- `accel_score = ((current - value_6mo_ago) - (value_6mo_ago - value_12mo_ago)) / hist_std`

## Quick Start

### With Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

On first run, the backend automatically generates 5 years of synthetic data for all 10 countries and computes 12 months of momentum scores. This takes ~30–60 seconds.

### Local Development

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Requires PostgreSQL running locally
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/countries` | List all countries with latest momentum |
| GET | `/api/momentum/{code}` | Full breakdown for a country |
| GET | `/api/momentum/timeseries/{code}` | 12-month history |
| GET | `/api/momentum/compare?countries=USA,DEU` | Multi-country comparison |
| POST | `/api/data/update` | Trigger data refresh |
| GET | `/api/health` | Health check |
| GET | `/docs` | Interactive API documentation |

## Configuration

Set environment variables in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/macro_momentum
FRED_API_KEY=your_fred_api_key  # Optional — falls back to synthetic data
SECRET_KEY=your-secret-key
```

## Data Sources

- **FRED** (Federal Reserve Economic Data) — US indicators
- **yfinance** — FX rates, equity indices
- **OECD SDMX** — International indicators
- **Synthetic fallback** — Realistic AR(1) time series when APIs unavailable

## 8 Pillars & Weights

| Pillar | Weight |
|--------|--------|
| FX & Capital | 20% |
| Domestic Demand | 18% |
| Industrial | 16% |
| Trade | 14% |
| Labor | 12% |
| Credit | 10% |
| Market Sentiment | 10% |
| Inflation | 8% |

## Momentum Categories

| Score | Category |
|-------|----------|
| ≥ 2.0 | Strongly Accelerating |
| 1.0 to 2.0 | Accelerating |
| -1.0 to 1.0 | Stable |
| -2.0 to -1.0 | Decelerating |
| ≤ -2.0 | Strongly Decelerating |
