import logging

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.asyncpg import AsyncPGIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from .config import get_settings
from .routers import (
    admin_dashboard,
    admin_invites,
    articles,
    comments,
    discover,
    events,
    ingest,
    leaderboard,
    lists,
    me_articles,
    recs,
    search,
    social,
    sources,
    topics,
    users,
)

_settings = get_settings()

# Sentry: silent no-op when SENTRY_DSN is unset (which it is in local dev
# and CI). In production set SENTRY_DSN on Render to start capturing errors.
if _settings.sentry_dsn:
    sentry_sdk.init(
        dsn=_settings.sentry_dsn,
        environment=_settings.sentry_environment,
        # Sample 10% of requests for transactions; 100% of errors.
        # Cheap to bump if free-tier quota allows.
        traces_sample_rate=0.1,
        # Send request headers + IPs + auth-derived user IDs along with
        # errors. Sentry's new data-scrubbing pipeline handles redaction
        # better than our manual opt-out did, and user-attached errors are
        # the headline win of the SDK.
        send_default_pii=True,
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            AsyncPGIntegration(),
        ],
    )
    logging.getLogger("zola.sentry").info(
        "Sentry initialized for environment=%s", _settings.sentry_environment
    )

app = FastAPI(title="Zola API", version="0.0.0")

# Allowed browser origins. Explicit list for local + production canonical
# domains; regex covers Vercel preview deploys (e.g. zola-<hash>-paullellouche.vercel.app)
# so PR previews can hit the API without bespoke config per branch.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://zolalongform.com",
        "https://www.zolalongform.com",
        "https://zola-brown-mu.vercel.app",  # vercel-assigned production alias
    ],
    allow_origin_regex=r"^https://zola-[a-z0-9]+-paullellouche\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(topics.router)
app.include_router(sources.router)
app.include_router(articles.router)
app.include_router(events.router)
app.include_router(ingest.router)
app.include_router(search.router)
app.include_router(me_articles.router)
app.include_router(lists.router)
app.include_router(social.router)
app.include_router(recs.router)
app.include_router(discover.router)
app.include_router(leaderboard.router)
app.include_router(comments.router)
app.include_router(admin_invites.router)
app.include_router(admin_dashboard.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    # Touch settings so a misconfigured env fails fast at first request.
    get_settings()
    return {"service": "zola-api", "version": "0.0.0"}

# Touch — force Render to re-pick HEAD (commits since 801b885 only changed
# apps/web, so the auto-deploy path filter may have skipped them).
