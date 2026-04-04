"""Log service: paginated queries for accounting, active sessions, and post-auth logs.

All methods use the RadAcct and RadPostAuth ORM models with optional WHERE filters
and standard (page, page_size) pagination.
"""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.radius import RadAcct, RadPostAuth
from app.schemas.logs import AccountingRecord, ActiveSession, PostAuthRecord
from app.schemas.radius import PaginatedResponse

_STATUS_MAP = {
    "accept": "Access-Accept",
    "reject": "Access-Reject",
}


class LogService:
    """Static async methods for RADIUS log queries with filtering and pagination."""

    @staticmethod
    async def get_accounting(
        db: AsyncSession,
        username: str | None = None,
        nas_ip: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[AccountingRecord]:
        """Return paginated radacct records with optional filters (LOG-01, LOG-04, LOG-05)."""
        base = select(RadAcct)

        if username is not None:
            base = base.where(RadAcct.username == username)
        if nas_ip is not None:
            base = base.where(RadAcct.nas_ip_address == nas_ip)
        if date_from is not None:
            base = base.where(RadAcct.acct_start_time >= date_from)
        if date_to is not None:
            base = base.where(RadAcct.acct_start_time <= date_to)

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total: int = count_result.scalar_one() or 0

        offset = (page - 1) * page_size
        result = await db.execute(
            base.order_by(RadAcct.acct_start_time.desc()).offset(offset).limit(page_size)
        )
        rows = list(result.scalars().all())

        items = [
            AccountingRecord(
                radacctid=row.radacctid,
                username=row.username,
                nas_ip_address=row.nas_ip_address,
                framedipaddress=None,  # RadAcct model does not have framedipaddress column
                acct_start_time=row.acct_start_time,
                acct_stop_time=row.acct_stop_time,
                acct_session_time=row.acct_session_time,
                acct_input_octets=row.acct_input_octets,
                acct_output_octets=row.acct_output_octets,
                terminate_cause=row.terminate_cause,
            )
            for row in rows
        ]

        return PaginatedResponse[AccountingRecord](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def get_active_sessions(
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[ActiveSession]:
        """Return paginated radacct records where AcctStopTime IS NULL (LOG-02, LOG-05)."""
        base = select(RadAcct).where(RadAcct.acct_stop_time.is_(None))

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total: int = count_result.scalar_one() or 0

        offset = (page - 1) * page_size
        result = await db.execute(
            base.order_by(RadAcct.acct_start_time.desc()).offset(offset).limit(page_size)
        )
        rows = list(result.scalars().all())

        items = [
            ActiveSession(
                radacctid=row.radacctid,
                username=row.username,
                nas_ip_address=row.nas_ip_address,
                framedipaddress=None,
                acct_start_time=row.acct_start_time,
                acct_stop_time=row.acct_stop_time,
                acct_session_time=row.acct_session_time,
                acct_input_octets=row.acct_input_octets,
                acct_output_octets=row.acct_output_octets,
            )
            for row in rows
        ]

        return PaginatedResponse[ActiveSession](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def get_postauth(
        db: AsyncSession,
        username: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedResponse[PostAuthRecord]:
        """Return paginated radpostauth records with optional filters (LOG-03, LOG-05).

        status: "accept" -> reply="Access-Accept", "reject" -> reply="Access-Reject", None -> no filter.
        """
        base = select(RadPostAuth)

        if username is not None:
            base = base.where(RadPostAuth.username == username)
        if status is not None:
            reply_value = _STATUS_MAP.get(status.lower())
            if reply_value:
                base = base.where(RadPostAuth.reply == reply_value)
        if date_from is not None:
            base = base.where(RadPostAuth.authdate >= date_from)
        if date_to is not None:
            base = base.where(RadPostAuth.authdate <= date_to)

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total: int = count_result.scalar_one() or 0

        offset = (page - 1) * page_size
        result = await db.execute(
            base.order_by(RadPostAuth.authdate.desc()).offset(offset).limit(page_size)
        )
        rows = list(result.scalars().all())

        items = [
            PostAuthRecord(
                id=row.id,
                username=row.username,
                reply=row.reply,
                authdate=row.authdate,
            )
            for row in rows
        ]

        return PaginatedResponse[PostAuthRecord](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
