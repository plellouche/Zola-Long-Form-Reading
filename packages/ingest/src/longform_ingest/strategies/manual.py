"""Manual strategy — no-op. Articles arrive only via admin URL submission."""

from __future__ import annotations

import asyncpg
import httpx

from ..robots import RobotsCache
from .base import Strategy, StrategyResult


class ManualStrategy(Strategy):
    async def fetch(
        self,
        *,
        client: httpx.AsyncClient,
        source: asyncpg.Record,
        robots: RobotsCache,
    ) -> StrategyResult:
        return StrategyResult(status="NO_CHANGES",
                              error_message="manual strategy — no auto-discovery")
