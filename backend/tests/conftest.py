import sqlite3

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db
from app.main import app
from app.models.app import AppBase
from app.services.user_service import create_user

# SQLite in-memory database does not support schemas natively.
# We use a "creator" function to open a raw sqlite3 connection and ATTACH
# a second in-memory database as the "app" schema before handing it to SQLAlchemy.
_SHARED_CONN: sqlite3.Connection | None = None


def _get_test_connection():
    """Return a single shared in-memory SQLite connection with 'app' schema attached."""
    global _SHARED_CONN
    if _SHARED_CONN is None:
        _SHARED_CONN = sqlite3.connect(":memory:", check_same_thread=False)
        # Attach a second in-memory database as the 'app' schema
        _SHARED_CONN.execute("ATTACH DATABASE ':memory:' AS app")
    return _SHARED_CONN


@pytest.fixture
async def db_engine():
    global _SHARED_CONN
    _SHARED_CONN = None  # Reset per test

    # Use creator= to control how connections are made
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        creator=_get_test_connection,
    )

    async with engine.begin() as conn:
        await conn.run_sync(AppBase.metadata.create_all)
    yield engine

    # Cleanup: drop all, close connection
    async with engine.begin() as conn:
        await conn.run_sync(AppBase.metadata.drop_all)
    await engine.dispose()
    if _SHARED_CONN is not None:
        _SHARED_CONN.close()
        _SHARED_CONN = None


@pytest.fixture
async def db_session(db_engine):
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def super_admin_user(db_session):
    return await create_user(db_session, "admin@test.com", "testpassword123", "super_admin")


@pytest.fixture
async def viewer_user(db_session):
    return await create_user(db_session, "viewer@test.com", "testpassword123", "viewer")


@pytest.fixture
async def admin_user(db_session):
    return await create_user(db_session, "admin2@test.com", "testpassword123", "admin")


@pytest.fixture
async def operator_user(db_session):
    return await create_user(db_session, "operator@test.com", "testpassword123", "operator")
