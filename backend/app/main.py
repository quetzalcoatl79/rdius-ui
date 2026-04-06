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


async def _seed_admin() -> None:
    """Create default Super Admin if no users exist in database."""
    try:
        async with AsyncSessionLocal() as db:
            from sqlalchemy import select, func
            from app.models.app import AppUser
            from app.core.security import hash_password

            count = await db.scalar(select(func.count()).select_from(AppUser))
            if count and count > 0:
                logger.info("Users exist (%d), skipping seed", count)
                return

            admin = AppUser(
                email=settings.seed_admin_email,
                hashed_password=hash_password(settings.seed_admin_password),
                role="super_admin",
                is_active=True,
            )
            # Set full_name if the model has it
            if hasattr(admin, "full_name"):
                admin.full_name = settings.seed_admin_name

            db.add(admin)
            await db.commit()
            logger.info("Seeded Super Admin: %s", settings.seed_admin_email)
    except Exception:
        logger.exception("Failed to seed admin user")


async def _ensure_materialized_views() -> None:
    """Create materialized views if they don't exist (first run or fresh DB)."""
    import pathlib
    sql_file = pathlib.Path(__file__).resolve().parent.parent / "sql" / "materialized_views.sql"
    if not sql_file.exists():
        logger.warning("materialized_views.sql not found at %s", sql_file)
        return
    sql = sql_file.read_text()
    from sqlalchemy import text
    for statement in sql.split(";"):
        stmt = statement.strip()
        lines = [l for l in stmt.split("\n") if l.strip() and not l.strip().startswith("--")]
        if not lines:
            continue
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(text(stmt))
                await db.commit()
        except Exception as e:
            if "already exists" in str(e):
                pass
            else:
                logger.warning("View statement skipped: %s", str(e)[:120])
    logger.info("Materialized views ensured")


async def _refresh_views_loop() -> None:
    """Refresh materialized views every N seconds (default 60)."""
    # Wait a bit on first start to let views be created
    await asyncio.sleep(5)
    while True:
        try:
            async with AsyncSessionLocal() as db:
                await DashboardService.refresh_materialized_views(db)
            logger.info("Materialized views refreshed")
        except Exception:
            logger.warning("Failed to refresh materialized views (may not exist yet)")
        await asyncio.sleep(settings.materialized_view_refresh_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed admin user if no users exist
    await _seed_admin()
    # Ensure materialized views exist before starting refresh loop
    await _ensure_materialized_views()
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
    redirect_slashes=False,
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
