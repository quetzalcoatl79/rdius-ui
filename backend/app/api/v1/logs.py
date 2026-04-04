"""Log API endpoints: accounting records, active sessions, post-auth logs (LOG-01..05)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.schemas.logs import AccountingRecord, ActiveSession, PostAuthRecord
from app.schemas.radius import PaginatedResponse
from app.services.log_service import LogService

router = APIRouter()

_VIEWER_ROLES = ("viewer", "operator", "admin", "super_admin")


@router.get("/accounting", response_model=PaginatedResponse[AccountingRecord])
async def get_accounting(
    username: str | None = Query(None, description="Filter by username"),
    nas_ip: str | None = Query(None, description="Filter by NAS IP address"),
    date_from: datetime | None = Query(None, description="Filter sessions starting after this date"),
    date_to: datetime | None = Query(None, description="Filter sessions starting before this date"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=200, description="Records per page"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> PaginatedResponse[AccountingRecord]:
    """Return paginated radacct records with optional filters (LOG-01, LOG-04, LOG-05)."""
    return await LogService.get_accounting(
        db,
        username=username,
        nas_ip=nas_ip,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )


@router.get("/sessions", response_model=PaginatedResponse[ActiveSession])
async def get_active_sessions(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=200, description="Records per page"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> PaginatedResponse[ActiveSession]:
    """Return paginated active sessions (AcctStopTime IS NULL) (LOG-02, LOG-05)."""
    return await LogService.get_active_sessions(db, page=page, page_size=page_size)


@router.get("/postauth", response_model=PaginatedResponse[PostAuthRecord])
async def get_postauth(
    username: str | None = Query(None, description="Filter by username"),
    status: str | None = Query(None, description="Filter by status: 'accept' or 'reject'"),
    date_from: datetime | None = Query(None, description="Filter by authdate >= date_from"),
    date_to: datetime | None = Query(None, description="Filter by authdate <= date_to"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(20, ge=1, le=200, description="Records per page"),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role(*_VIEWER_ROLES)),
) -> PaginatedResponse[PostAuthRecord]:
    """Return paginated post-auth records with optional filters (LOG-03, LOG-05)."""
    return await LogService.get_postauth(
        db,
        username=username,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
