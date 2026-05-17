# services/api — FastAPI backend

## First-time setup

```bash
cd services/api
/usr/local/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Install the local ingestion package (non-editable; see note below)
pip install ../../packages/ingest
```

### Local dev gotcha: re-installing `packages/ingest`

The ingest package is intentionally installed **non-editable** locally (not `pip install -e`). The reason: macOS, on this Documents-folder path with spaces, auto-applies `UF_HIDDEN` to `.pth` files in `site-packages`, which makes Python's `site.py` skip the PEP 660 editable-install pointer. Non-editable side-steps the issue entirely.

Trade-off: when you change code under `packages/ingest`, you need to reinstall:

```bash
pip install --force-reinstall --no-deps ../../packages/ingest
```

On Linux (CI / Render), editable installs work fine — the GitHub Actions workflow installs the package fresh per run, so there's no equivalent friction in production.

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
