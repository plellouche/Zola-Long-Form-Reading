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

### Local dev: installing `packages/ingest`

Use the repo-root Makefile target, which does the editable install plus the macOS post-install fixup in one command:

```bash
make install-ingest-dev
```

Why a special target: setuptools' editable install writes a `.pth` file in `site-packages` with macOS' `UF_HIDDEN` flag set (long-standing setuptools quirk). Python 3.12+'s `site.addpackage` then skips the file as hidden (`Skipping hidden .pth file: …`) and `import longform_ingest` silently fails. `make install-ingest-dev` runs `chflags -R nohidden` on `site-packages` immediately after install — confirmed working.

With editable mode on, code changes under `packages/ingest/src/` are picked up without reinstall. Re-run `make install-ingest-dev` only when `pyproject.toml` changes or when the venv has been wiped.

Production (Render + GHA) uses a non-editable `pip install ./packages/ingest`, which is not affected by this bug.

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
