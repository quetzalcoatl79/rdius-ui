"""Audit logging service.

Writes AuditLog rows within the caller's transaction — uses flush() not commit().
This ensures audit entries and data mutations are always in the same transaction.
"""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import AppUser, AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """Static-method service for writing audit log entries."""

    @staticmethod
    async def log(
        db: AsyncSession,
        user: AppUser,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """Create an AuditLog row within the caller's active transaction.

        Uses db.flush() (not db.commit()) so the audit entry and the triggering
        data change are committed together by the endpoint's transaction handler.
        """
        entry = AuditLog(
            user_id=user.id,
            user_email=user.email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
        )
        db.add(entry)
        await db.flush()
        logger.debug(
            "audit: user=%s action=%s resource_type=%s resource_id=%s",
            user.email,
            action,
            resource_type,
            resource_id,
        )
