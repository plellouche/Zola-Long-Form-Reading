from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings

app = FastAPI(title="Longform API", version="0.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    # Touch settings so a misconfigured env fails fast at first request.
    get_settings()
    return {"service": "longform-api", "version": "0.0.0"}
