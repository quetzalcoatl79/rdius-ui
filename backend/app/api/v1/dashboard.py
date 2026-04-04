"""Dashboard API endpoints: metrics, auth rates, traffic, top users, SSE stream (DASH-01..05)."""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.security import verify_token
from app.db.session import AsyncSessionLocal
from app.schemas.dashboard import (
    AuthRateBucket,
    DashboardMetrics,
    TimeRange,
    TopUser,
    TrafficPerNas,
)
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter()

_VIEWER_ROLES = ("viewer", "operator", "admin", "super_admin")


@router.get("/metrics", response_model=DashboardMetrics)
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> DashboardMetrics:
    """Return aggregated dashboard metric counts (DASH-01)."""
    return await DashboardService.get_metrics(db)


@router.get("/auth-rates", response_model=list[AuthRateBucket])
async def get_auth_rates(
    range: TimeRange = Query(TimeRange.ONE_DAY, description="Time range for auth rate buckets"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> list[AuthRateBucket]:
    """Return time-bucketed auth success/failure counts (DASH-02)."""
    return await DashboardService.get_auth_rates(db, range)


@router.get("/traffic-per-nas", response_model=list[TrafficPerNas])
async def get_traffic_per_nas(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> list[TrafficPerNas]:
    """Return total bandwidth in/out per NAS (DASH-04)."""
    return await DashboardService.get_traffic_per_nas(db)


@router.get("/top-users", response_model=list[TopUser])
async def get_top_users(
    by: str = Query("traffic", description="Sort by 'traffic' (bytes) or 'time' (session seconds)"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of users to return"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> list[TopUser]:
    """Return users ranked by traffic or session time (DASH-05)."""
    return await DashboardService.get_top_users(db, by=by, limit=limit)


@router.get("/sessions/stream")
async def stream_sessions(
    token: str = Query(..., description="JWT access token (EventSource cannot set headers)"),
) -> StreamingResponse:
    """SSE endpoint streaming active session count every 5 seconds (DASH-03).

    Authentication uses a query-param token because the browser EventSource API
    cannot set Authorization headers.
    """
    # Validate token before opening the stream
    payload = verify_token(token, expected_type="access")
    role: str = payload.get("role", "")
    if role not in _VIEWER_ROLES:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role for session stream",
        )

    async def event_generator():
        while True:
            try:
                async with AsyncSessionLocal() as db:
                    count = await DashboardService.get_active_session_count(db)
                yield f"data: {json.dumps({'active_sessions': count})}\n\n"
            except Exception:
                logger.exception("SSE event generator error")
                yield f"data: {json.dumps({'error': 'internal error'})}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
