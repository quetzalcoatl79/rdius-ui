"""Tests for DashboardService.

Uses SQLite in-memory with ATTACH DATABASE for 'radius' schema.
Materialized view methods (get_auth_rates, get_traffic_per_nas, get_top_users)
are NOT tested here — SQLite does not support materialized views. Those are
tested against PostgreSQL in integration tests (future). Only the base-table
methods and get_active_session_count are covered.
"""

import sqlite3
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.radius import RadAcct, RadCheck, RadPostAuth, RadiusBase

_SHARED_DASH_CONN: sqlite3.Connection | None = None


def _get_dash_test_connection():
    """Return a shared SQLite connection with 'radius' schema attached."""
    global _SHARED_DASH_CONN
    if _SHARED_DASH_CONN is None:
        _SHARED_DASH_CONN = sqlite3.connect(":memory:", check_same_thread=False)
        _SHARED_DASH_CONN.execute("ATTACH DATABASE ':memory:' AS radius")
    return _SHARED_DASH_CONN


@pytest.fixture
async def dash_engine():
    global _SHARED_DASH_CONN
    _SHARED_DASH_CONN = None

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        creator=_get_dash_test_connection,
    )

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.drop_all)
    await engine.dispose()
    if _SHARED_DASH_CONN is not None:
        _SHARED_DASH_CONN.close()
        _SHARED_DASH_CONN = None


@pytest.fixture
async def dash_db(dash_engine):
    factory = async_sessionmaker(dash_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


class TestDashboardServiceMetrics:
    async def test_get_metrics_returns_zeros_on_empty_tables(self, dash_db: AsyncSession):
        """get_metrics returns all zeros when tables are empty."""
        from app.services.dashboard_service import DashboardService

        result = await DashboardService.get_metrics(dash_db)
        assert result.total_users == 0
        assert result.active_sessions == 0
        assert result.nas_count == 0
        assert result.recent_auth_failures == 0

    async def test_get_metrics_counts_distinct_users(self, dash_db: AsyncSession):
        """get_metrics.total_users counts distinct usernames in radcheck."""
        from app.services.dashboard_service import DashboardService

        # Insert two rows for the same user and one for another
        dash_db.add(RadCheck(username="alice", attribute="Cleartext-Password", op=":=", value="pw1"))
        dash_db.add(RadCheck(username="alice", attribute="Auth-Type", op=":=", value="Local"))
        dash_db.add(RadCheck(username="bob", attribute="Cleartext-Password", op=":=", value="pw2"))
        await dash_db.commit()

        result = await DashboardService.get_metrics(dash_db)
        assert result.total_users == 2

    async def test_get_metrics_counts_active_sessions(self, dash_db: AsyncSession):
        """get_metrics.active_sessions counts only sessions without a stop time."""
        from app.services.dashboard_service import DashboardService

        now = datetime.now(timezone.utc)
        # Active session (no stop time) — radacctid must be set explicitly for SQLite
        dash_db.add(RadAcct(
            radacctid=1,
            acct_session_id="s1",
            acct_unique_id="u1",
            username="alice",
            nas_ip_address="192.168.1.1",
            acct_start_time=now,
            acct_stop_time=None,
        ))
        # Closed session (has stop time)
        dash_db.add(RadAcct(
            radacctid=2,
            acct_session_id="s2",
            acct_unique_id="u2",
            username="bob",
            nas_ip_address="192.168.1.1",
            acct_start_time=now,
            acct_stop_time=now,
        ))
        await dash_db.commit()

        result = await DashboardService.get_metrics(dash_db)
        assert result.active_sessions == 1

    async def test_get_metrics_counts_auth_failures(self, dash_db: AsyncSession):
        """get_metrics.recent_auth_failures counts only Access-Reject within 24h."""
        from app.services.dashboard_service import DashboardService

        now = datetime.now(timezone.utc)
        # Explicit id required for SQLite (BigInteger + RETURNING quirk)
        dash_db.add(RadPostAuth(id=1, username="alice", pass_="x", reply="Access-Reject", authdate=now))
        dash_db.add(RadPostAuth(id=2, username="alice", pass_="x", reply="Access-Accept", authdate=now))
        await dash_db.commit()

        result = await DashboardService.get_metrics(dash_db)
        assert result.recent_auth_failures == 1

    async def test_get_active_session_count_returns_correct_count(self, dash_db: AsyncSession):
        """get_active_session_count counts sessions where AcctStopTime IS NULL."""
        from app.services.dashboard_service import DashboardService

        now = datetime.now(timezone.utc)
        for i in range(3):
            dash_db.add(RadAcct(
                radacctid=i + 1,
                acct_session_id=f"s{i}",
                acct_unique_id=f"u{i}",
                username=f"user{i}",
                nas_ip_address="10.0.0.1",
                acct_start_time=now,
                acct_stop_time=None,
            ))
        dash_db.add(RadAcct(
            radacctid=100,
            acct_session_id="closed",
            acct_unique_id="uclosed",
            username="done",
            nas_ip_address="10.0.0.1",
            acct_start_time=now,
            acct_stop_time=now,
        ))
        await dash_db.commit()

        count = await DashboardService.get_active_session_count(dash_db)
        assert count == 3

    async def test_get_active_session_count_empty(self, dash_db: AsyncSession):
        """get_active_session_count returns 0 when table is empty."""
        from app.services.dashboard_service import DashboardService

        count = await DashboardService.get_active_session_count(dash_db)
        assert count == 0
