# services/api — FastAPI backend

## First-time setup

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run dev server

From the repo root:
```bash
pnpm dev:api
```

Or directly:
```bash
cd services/api && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/healthz`

## Alembic migrations

```bash
# Create a new migration (autogenerate from SQLAlchemy models)
alembic revision --autogenerate -m "describe change"

# Apply
alembic upgrade head

# Roll back
alembic downgrade -1
```
