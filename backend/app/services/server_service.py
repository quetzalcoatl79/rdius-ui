"""Server registry and audit log query service.

Provides CRUD for the app.servers table and paginated queries for app.audit_log.
All methods are static (same pattern as RadiusUserService, NasService).
"""

import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import AuditLog, Server
from app.schemas.server import ServerCreate, ServerUpdate

logger = logging.getLogger(__name__)


class ServerService:
    """Static-method service for server registry and audit log queries."""

    @staticmethod
    async def list_servers(db: AsyncSession) -> list[Server]:
        """Return all active servers ordered by name."""
        result = await db.execute(
            select(Server).where(Server.is_active == True).order_by(Server.name)  # noqa: E712
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_server(db: AsyncSession, server_id: uuid.UUID) -> Optional[Server]:
        """Return a single server by ID, or None if not found."""
        result = await db.execute(select(Server).where(Server.id == server_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create_server(db: AsyncSession, data: ServerCreate) -> Server:
        """Insert a new server registration and return it."""
        server = Server(
            name=data.name,
            docker_container_id=data.docker_container_id,
            description=data.description,
        )
        db.add(server)
        await db.flush()
        await db.refresh(server)
        return server

    @staticmethod
    async def update_server(
        db: AsyncSession, server_id: uuid.UUID, data: ServerUpdate
    ) -> Optional[Server]:
        """Update non-None fields on a server. Returns updated server or None."""
        result = await db.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()
        if server is None:
            return None

        update_data = data.model_dump(exclude_none=True)
        for field, value in update_data.items():
            setattr(server, field, value)

        await db.flush()
        await db.refresh(server)
        return server

    @staticmethod
    async def delete_server(db: AsyncSession, server_id: uuid.UUID) -> bool:
        """Delete a server by ID. Returns True if deleted, False if not found."""
        result = await db.execute(select(Server).where(Server.id == server_id))
        server = result.scalar_one_or_none()
        if server is None:
            return False

        await db.delete(server)
        await db.flush()
        return True

    @staticmethod
    async def list_audit_logs(
        db: AsyncSession,
        user_email: Optional[str],
        action: Optional[str],
        resource_type: Optional[str],
        date_from: Optional[datetime],
        date_to: Optional[datetime],
        page: int,
        page_size: int,
    ) -> tuple[list[AuditLog], int]:
        """Return paginated audit logs with optional filters.

        Returns (rows, total_count) ordered by created_at DESC.
        """
        base_query = select(AuditLog)

        if user_email is not None:
            base_query = base_query.where(AuditLog.user_email == user_email)
        if action is not None:
            base_query = base_query.where(AuditLog.action == action)
        if resource_type is not None:
            base_query = base_query.where(AuditLog.resource_type == resource_type)
        if date_from is not None:
            base_query = base_query.where(AuditLog.created_at >= date_from)
        if date_to is not None:
            base_query = base_query.where(AuditLog.created_at <= date_to)

        # Total count
        count_query = select(func.count()).select_from(base_query.subquery())
        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        # Paginated rows
        offset = (page - 1) * page_size
        rows_query = (
            base_query.order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        rows_result = await db.execute(rows_query)
        rows = list(rows_result.scalars().all())

        return rows, total
