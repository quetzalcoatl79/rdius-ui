import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import AsyncSessionLocal, engine
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)


async def _refresh_views_loop() -> None:
    """Refresh materialized views every N seconds (default 60)."""
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await DashboardService.refresh_materialized_views(db)
            logger.info("Materialized views refreshed")
        except Exception:
            logger.exception("Failed to refresh materialized views")
        await asyncio.sleep(settings.materialized_view_refresh_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Alembic runs migrations at startup (in Docker entrypoint, not here)
    refresh_task = asyncio.create_task(_refresh_views_loop())
    yield
    refresh_task.cancel()
    try:
        await refresh_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


app = FastAPI(
    title="Radius UI API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
