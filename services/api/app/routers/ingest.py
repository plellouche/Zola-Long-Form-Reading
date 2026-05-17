from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, HttpUrl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from longform_ingest.runner import ingest_source_by_slug

from ..auth_admin import require_admin
from ..database import get_session
from ..models import Source

router = APIRouter(prefix="/api", tags=["ingest"])


# ---------- POST /api/admin/sources/{id}/ingest ----------


class IngestTriggerResponse(BaseModel):
    queued: bool
    source_slug: str
    message: str


async def _run_ingest(slug: str) -> None:
    # Detached background task; logs go to API stderr.
    try:
        await ingest_source_by_slug(slug, triggered_by="admin")
    except Exception:  # noqa: BLE001
        # The runner already writes ingestion_runs ERROR rows; surface here too.
        import logging
        logging.getLogger("longform.ingest").exception("background ingest failed for %s", slug)


@router.post(
    "/admin/sources/{source_id}/ingest",
    response_model=IngestTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def trigger_ingest(
    source_id: UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    _: object = Depends(require_admin),
) -> IngestTriggerResponse:
    result = await session.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
    background_tasks.add_task(_run_ingest, source.slug)
    return IngestTriggerResponse(
        queued=True,
        source_slug=source.slug,
        message=f"Ingestion queued for {source.name}; refresh in a few seconds.",
    )


# ---------- POST /api/ingest/url (OG draft) ----------


class UrlSubmitRequest(BaseModel):
    url: HttpUrl


class UrlDraftResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    canonical_url: str
    title: str | None
    description: str | None
    author: str | None
    publication_date: date | None
    og_image_url: str | None


@router.post("/ingest/url", response_model=UrlDraftResponse)
async def ingest_url_draft(
    payload: UrlSubmitRequest,
    _: object = Depends(require_admin),
) -> UrlDraftResponse:
    """Fetch OpenGraph metadata for a URL and return a draft. Admin saves via POST /api/articles."""
    import httpx
    from longform_ingest.og import fetch_og
    from longform_ingest.robots import RobotsCache

    robots = RobotsCache()
    async with httpx.AsyncClient() as client:
        meta = await fetch_og(client, str(payload.url), robots)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not fetch metadata (robots.txt disallowed, network error, or non-HTML response).",
        )
    return UrlDraftResponse(
        canonical_url=meta.canonical_url,
        title=meta.title,
        description=meta.description,
        author=meta.author,
        publication_date=meta.publication_date,
        og_image_url=meta.og_image_url,
    )
