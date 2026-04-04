"""Tests for LogService.

Uses SQLite in-memory with ATTACH DATABASE for 'radius' schema.
Covers get_accounting, get_active_sessions, and get_postauth with
filtering, pagination, and empty-table edge cases.
"""

import sqlite3
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.radius import RadAcct, RadPostAuth, RadiusBase

_SHARED_LOG_CONN: sqlite3.Connection | None = None
_postauth_id_counter = 0


def _get_log_test_connection():
    """Return a shared SQLite connection with 'radius' schema attached."""
    global _SHARED_LOG_CONN
    if _SHARED_LOG_CONN is None:
        _SHARED_LOG_CONN = sqlite3.connect(":memory:", check_same_thread=False)
        _SHARED_LOG_CONN.execute("ATTACH DATABASE ':memory:' AS radius")
    return _SHARED_LOG_CONN


@pytest.fixture
async def log_engine():
    global _SHARED_LOG_CONN, _acct_id_counter, _postauth_id_counter
    _SHARED_LOG_CONN = None
    _acct_id_counter = 0
    _postauth_id_counter = 0

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        creator=_get_log_test_connection,
    )

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.drop_all)
    await engine.dispose()
    if _SHARED_LOG_CONN is not None:
        _SHARED_LOG_CONN.close()
        _SHARED_LOG_CONN = None


@pytest.fixture
async def log_db(log_engine):
    factory = async_sessionmaker(log_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


_acct_id_counter = 0


def _make_postauth(username: str, reply: str, authdate: datetime) -> RadPostAuth:
    """Create a RadPostAuth with explicit id (required for SQLite BigInteger PK)."""
    global _postauth_id_counter
    _postauth_id_counter += 1
    return RadPostAuth(id=_postauth_id_counter, username=username, pass_="x", reply=reply, authdate=authdate)


def _make_acct(session_id: str, unique_id: str, username: str, nas_ip: str,
               start: datetime, stop: datetime | None = None) -> RadAcct:
    """Create a RadAcct instance with an explicit radacctid (required for SQLite)."""
    global _acct_id_counter
    _acct_id_counter += 1
    return RadAcct(
        radacctid=_acct_id_counter,
        acct_session_id=session_id,
        acct_unique_id=unique_id,
        username=username,
        nas_ip_address=nas_ip,
        acct_start_time=start,
        acct_stop_time=stop,
        acct_session_time=100,
        acct_input_octets=1024,
        acct_output_octets=2048,
        terminate_cause=None,
    )


class TestLogServiceAccounting:
    async def test_get_accounting_empty_returns_empty(self, log_db: AsyncSession):
        """get_accounting returns PaginatedResponse with empty items when no data."""
        from app.services.log_service import LogService

        result = await LogService.get_accounting(log_db)
        assert result.total == 0
        assert result.items == []
        assert result.page == 1

    async def test_get_accounting_returns_all_records(self, log_db: AsyncSession):
        """get_accounting returns all records with no filters."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_acct("s1", "u1", "alice", "10.0.0.1", now))
        log_db.add(_make_acct("s2", "u2", "bob", "10.0.0.2", now))
        await log_db.commit()

        result = await LogService.get_accounting(log_db)
        assert result.total == 2
        assert len(result.items) == 2

    async def test_get_accounting_filters_by_username(self, log_db: AsyncSession):
        """get_accounting filters to only matching username."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_acct("s1", "u1", "alice", "10.0.0.1", now))
        log_db.add(_make_acct("s2", "u2", "bob", "10.0.0.2", now))
        await log_db.commit()

        result = await LogService.get_accounting(log_db, username="alice")
        assert result.total == 1
        assert result.items[0].username == "alice"

    async def test_get_accounting_filters_by_nas_ip(self, log_db: AsyncSession):
        """get_accounting filters by NAS IP address."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_acct("s1", "u1", "alice", "10.0.0.1", now))
        log_db.add(_make_acct("s2", "u2", "bob", "10.0.0.2", now))
        await log_db.commit()

        result = await LogService.get_accounting(log_db, nas_ip="10.0.0.2")
        assert result.total == 1
        assert result.items[0].nas_ip_address == "10.0.0.2"

    async def test_get_accounting_filters_by_date_range(self, log_db: AsyncSession):
        """get_accounting filters by date_from and date_to."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        old = now - timedelta(days=10)
        log_db.add(_make_acct("s1", "u1", "alice", "10.0.0.1", old))
        log_db.add(_make_acct("s2", "u2", "bob", "10.0.0.1", now))
        await log_db.commit()

        cutoff = now - timedelta(days=5)
        result = await LogService.get_accounting(log_db, date_from=cutoff)
        assert result.total == 1
        assert result.items[0].username == "bob"

    async def test_get_accounting_paginates_correctly(self, log_db: AsyncSession):
        """get_accounting returns correct page slices."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        for i in range(5):
            log_db.add(_make_acct(f"s{i}", f"u{i}", f"user{i}", "10.0.0.1", now))
        await log_db.commit()

        page1 = await LogService.get_accounting(log_db, page=1, page_size=3)
        assert page1.total == 5
        assert len(page1.items) == 3

        page2 = await LogService.get_accounting(log_db, page=2, page_size=3)
        assert page2.total == 5
        assert len(page2.items) == 2


class TestLogServiceActiveSessions:
    async def test_get_active_sessions_empty(self, log_db: AsyncSession):
        """get_active_sessions returns empty PaginatedResponse when no data."""
        from app.services.log_service import LogService

        result = await LogService.get_active_sessions(log_db)
        assert result.total == 0
        assert result.items == []

    async def test_get_active_sessions_returns_only_open(self, log_db: AsyncSession):
        """get_active_sessions returns only records with AcctStopTime IS NULL."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_acct("open1", "u1", "alice", "10.0.0.1", now, stop=None))
        log_db.add(_make_acct("closed1", "u2", "bob", "10.0.0.1", now, stop=now))
        await log_db.commit()

        result = await LogService.get_active_sessions(log_db)
        assert result.total == 1
        assert result.items[0].username == "alice"
        assert result.items[0].acct_stop_time is None

    async def test_get_active_sessions_pagination(self, log_db: AsyncSession):
        """get_active_sessions paginates correctly."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        for i in range(4):
            log_db.add(_make_acct(f"s{i}", f"u{i}", f"user{i}", "10.0.0.1", now, stop=None))
        await log_db.commit()

        page1 = await LogService.get_active_sessions(log_db, page=1, page_size=2)
        assert page1.total == 4
        assert len(page1.items) == 2


class TestLogServicePostAuth:
    async def test_get_postauth_empty(self, log_db: AsyncSession):
        """get_postauth returns empty PaginatedResponse when no data."""
        from app.services.log_service import LogService

        result = await LogService.get_postauth(log_db)
        assert result.total == 0
        assert result.items == []

    async def test_get_postauth_filters_by_accept(self, log_db: AsyncSession):
        """get_postauth status='accept' returns only Access-Accept rows."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_postauth("alice", "Access-Accept", now))
        log_db.add(_make_postauth("bob", "Access-Reject", now))
        await log_db.commit()

        result = await LogService.get_postauth(log_db, status="accept")
        assert result.total == 1
        assert result.items[0].reply == "Access-Accept"

    async def test_get_postauth_filters_by_reject(self, log_db: AsyncSession):
        """get_postauth status='reject' returns only Access-Reject rows."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_postauth("alice", "Access-Accept", now))
        log_db.add(_make_postauth("bob", "Access-Reject", now))
        await log_db.commit()

        result = await LogService.get_postauth(log_db, status="reject")
        assert result.total == 1
        assert result.items[0].reply == "Access-Reject"

    async def test_get_postauth_no_status_filter_returns_all(self, log_db: AsyncSession):
        """get_postauth with no status returns all records."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_postauth("alice", "Access-Accept", now))
        log_db.add(_make_postauth("bob", "Access-Reject", now))
        await log_db.commit()

        result = await LogService.get_postauth(log_db)
        assert result.total == 2

    async def test_get_postauth_filters_by_date_range(self, log_db: AsyncSession):
        """get_postauth filters by date_from and date_to."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        old = now - timedelta(days=10)
        log_db.add(_make_postauth("alice", "Access-Accept", old))
        log_db.add(_make_postauth("bob", "Access-Reject", now))
        await log_db.commit()

        cutoff = now - timedelta(days=5)
        result = await LogService.get_postauth(log_db, date_from=cutoff)
        assert result.total == 1
        assert result.items[0].username == "bob"

    async def test_get_postauth_filters_by_username(self, log_db: AsyncSession):
        """get_postauth filters by username."""
        from app.services.log_service import LogService

        now = datetime.now(timezone.utc)
        log_db.add(_make_postauth("alice", "Access-Accept", now))
        log_db.add(_make_postauth("bob", "Access-Reject", now))
        await log_db.commit()

        result = await LogService.get_postauth(log_db, username="alice")
        assert result.total == 1
        assert result.items[0].username == "alice"
