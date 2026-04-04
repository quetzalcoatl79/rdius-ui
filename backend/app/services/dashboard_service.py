"""Dashboard service: aggregated metrics from base tables and materialized views.

- get_metrics, get_active_session_count: query live base tables (radcheck, radacct, nas, radpostauth)
- get_auth_rates, get_traffic_per_nas, get_top_users: query materialized views (mv_*)
- refresh_materialized_views: REFRESH MATERIALIZED VIEW CONCURRENTLY for all 3 views
"""

import logging
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.radius import Nas, RadAcct, RadCheck, RadPostAuth
from app.schemas.dashboard import (
    AuthRateBucket,
    DashboardMetrics,
    TimeRange,
    TopUser,
    TrafficPerNas,
)

logger = logging.getLogger(__name__)

_RANGE_TO_DELTA: dict[TimeRange, timedelta] = {
    TimeRange.ONE_HOUR: timedelta(hours=1),
    TimeRange.ONE_DAY: timedelta(hours=24),
    TimeRange.SEVEN_DAYS: timedelta(days=7),
    TimeRange.THIRTY_DAYS: timedelta(days=30),
}


class DashboardService:
    """Static async methods for dashboard metrics queries."""

    @staticmethod
    async def get_metrics(db: AsyncSession) -> DashboardMetrics:
        """Return aggregated dashboard metric counts from base tables."""
        # Total distinct usernames in radcheck
        total_users_result = await db.execute(
            select(func.count(func.distinct(RadCheck.username)))
        )
        total_users: int = total_users_result.scalar_one() or 0

        # Active sessions: AcctStopTime IS NULL
        active_sessions_result = await db.execute(
            select(func.count()).select_from(RadAcct).where(RadAcct.acct_stop_time.is_(None))
        )
        active_sessions: int = active_sessions_result.scalar_one() or 0

        # NAS count
        nas_count_result = await db.execute(select(func.count()).select_from(Nas))
        nas_count: int = nas_count_result.scalar_one() or 0

        # Recent auth failures: Access-Reject in last 24 hours
        cutoff_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        failures_result = await db.execute(
            select(func.count())
            .select_from(RadPostAuth)
            .where(
                RadPostAuth.reply == "Access-Reject",
                RadPostAuth.authdate >= cutoff_24h,
            )
        )
        recent_auth_failures: int = failures_result.scalar_one() or 0

        return DashboardMetrics(
            total_users=total_users,
            active_sessions=active_sessions,
            nas_count=nas_count,
            recent_auth_failures=recent_auth_failures,
        )

    @staticmethod
    async def get_active_session_count(db: AsyncSession) -> int:
        """Return current count of active sessions (AcctStopTime IS NULL).

        Used by the SSE endpoint for real-time updates.
        """
        result = await db.execute(
            select(func.count()).select_from(RadAcct).where(RadAcct.acct_stop_time.is_(None))
        )
        return result.scalar_one() or 0

    @staticmethod
    async def get_auth_rates(db: AsyncSession, range: TimeRange = TimeRange.ONE_DAY) -> list[AuthRateBucket]:
        """Return time-bucketed auth success/failure counts from mv_auth_rates.

        Queries the materialized view — requires PostgreSQL.
        """
        delta = _RANGE_TO_DELTA[range]
        cutoff = datetime.now(timezone.utc) - delta

        result = await db.execute(
            text(
                "SELECT bucket, success, failure FROM radius.mv_auth_rates "
                "WHERE bucket >= :cutoff ORDER BY bucket"
            ),
            {"cutoff": cutoff},
        )
        rows = result.fetchall()
        return [
            AuthRateBucket(bucket=row.bucket, success=row.success, failure=row.failure)
            for row in rows
        ]

    @staticmethod
    async def get_traffic_per_nas(db: AsyncSession) -> list[TrafficPerNas]:
        """Return total bytes in/out per NAS from mv_traffic_per_nas.

        Queries the materialized view — requires PostgreSQL.
        """
        result = await db.execute(
            text(
                "SELECT nas_ip, shortname, bytes_in, bytes_out "
                "FROM radius.mv_traffic_per_nas "
                "ORDER BY bytes_in + bytes_out DESC"
            )
        )
        rows = result.fetchall()
        return [
            TrafficPerNas(
                nas_ip=row.nas_ip,
                shortname=row.shortname,
                bytes_in=row.bytes_in,
                bytes_out=row.bytes_out,
            )
            for row in rows
        ]

    @staticmethod
    async def get_top_users(
        db: AsyncSession,
        by: str = "traffic",
        limit: int = 10,
    ) -> list[TopUser]:
        """Return users ranked by total traffic or session time from mv_top_users.

        Queries the materialized view — requires PostgreSQL.
        """
        if by == "time":
            order_col = "total_session_time"
        else:
            order_col = "total_bytes"

        result = await db.execute(
            text(
                f"SELECT username, total_bytes, total_session_time "
                f"FROM radius.mv_top_users "
                f"ORDER BY {order_col} DESC "
                f"LIMIT :limit"
            ),
            {"limit": limit},
        )
        rows = result.fetchall()
        return [
            TopUser(
                username=row.username,
                total_bytes=row.total_bytes,
                total_session_time=row.total_session_time,
            )
            for row in rows
        ]

    @staticmethod
    async def refresh_materialized_views(db: AsyncSession) -> None:
        """Refresh all 3 materialized views concurrently.

        Uses REFRESH MATERIALIZED VIEW CONCURRENTLY which requires a unique index
        on each view. Each view must already exist (created via materialized_views.sql).
        """
        views = [
            "radius.mv_auth_rates",
            "radius.mv_traffic_per_nas",
            "radius.mv_top_users",
        ]
        t0 = time.monotonic()
        for view in views:
            await db.execute(text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}"))
        duration_ms = int((time.monotonic() - t0) * 1000)
        logger.info("Refreshed %d materialized views in %dms", len(views), duration_ms)
