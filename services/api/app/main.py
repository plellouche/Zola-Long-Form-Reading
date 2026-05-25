from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import (
    admin_invites,
    articles,
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
app.include_router(admin_invites.router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    # Touch settings so a misconfigured env fails fast at first request.
    get_settings()
    return {"service": "zola-api", "version": "0.0.0"}
