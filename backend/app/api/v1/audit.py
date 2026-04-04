"""Audit log API endpoints.

Provides paginated, filterable read access to the audit trail.
Restricted to admin and super_admin roles (AUDIT-03).
"""

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.app import AppUser
from app.schemas.audit import AuditLogResponse
from app.schemas.radius import PaginatedResponse
from app.services.server_service import ServerService

router = APIRouter()

_admin_deps = Depends(require_role("admin", "super_admin"))


@router.get("/", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
    user_email: Optional[str] = Query(default=None, description="Filter by user email"),
    action: Optional[str] = Query(default=None, description="Filter by action (create, update, delete, restart)"),
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type (server, radius_user, nas, group)"),
    date_from: Optional[datetime] = Query(default=None, description="Filter by start date (ISO 8601)"),
    date_to: Optional[datetime] = Query(default=None, description="Filter by end date (ISO 8601)"),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=200, description="Items per page"),
) -> PaginatedResponse[AuditLogResponse]:
    """Return paginated audit logs with optional filters (AUDIT-03).

    Supports filtering by user email, action, resource type, and date range.
    Results are ordered by created_at DESC (most recent first).
    """
    rows, total = await ServerService.list_audit_logs(
        db=db,
        user_email=user_email,
        action=action,
        resource_type=resource_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return PaginatedResponse[AuditLogResponse](
        items=[AuditLogResponse.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
