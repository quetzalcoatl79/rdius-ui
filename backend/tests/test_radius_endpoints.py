"""Tests for RADIUS REST API endpoints — RBAC enforcement and basic CRUD.

Uses a combined SQLite fixture with both 'app' and 'radius' schemas attached.
NasService.trigger_freeradius_restart is monkeypatched to avoid Docker socket calls.
"""

import sqlite3

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_db
from app.main import app
from app.models.app import AppBase
from app.models.radius import RadiusBase
from app.services.user_service import create_user as create_app_user

# ---------------------------------------------------------------------------
# Combined fixture: app + radius schemas in SQLite
# ---------------------------------------------------------------------------

_SHARED_COMBINED_CONN: sqlite3.Connection | None = None


def _get_combined_test_connection():
    global _SHARED_COMBINED_CONN
    if _SHARED_COMBINED_CONN is None:
        _SHARED_COMBINED_CONN = sqlite3.connect(":memory:", check_same_thread=False)
        _SHARED_COMBINED_CONN.execute("ATTACH DATABASE ':memory:' AS app")
        _SHARED_COMBINED_CONN.execute("ATTACH DATABASE ':memory:' AS radius")
    return _SHARED_COMBINED_CONN


@pytest.fixture
async def combined_db_engine():
    global _SHARED_COMBINED_CONN
    _SHARED_COMBINED_CONN = None

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        creator=_get_combined_test_connection,
    )

    async with engine.begin() as conn:
        await conn.run_sync(AppBase.metadata.create_all)
        await conn.run_sync(RadiusBase.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.drop_all)
        await conn.run_sync(AppBase.metadata.drop_all)
    await engine.dispose()
    if _SHARED_COMBINED_CONN is not None:
        _SHARED_COMBINED_CONN.close()
        _SHARED_COMBINED_CONN = None


@pytest.fixture
async def combined_db(combined_db_engine):
    factory = async_sessionmaker(combined_db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
async def radius_client(combined_db, monkeypatch):
    """HTTP test client with combined app+radius DB and mocked FreeRADIUS restart."""
    from app.services import radius_service

    async def mock_restart(*args, **kwargs):
        return True

    monkeypatch.setattr(radius_service.NasService, "trigger_freeradius_restart", mock_restart)

    async def override_get_db():
        yield combined_db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# App user fixtures (for token generation)
# ---------------------------------------------------------------------------


@pytest.fixture
async def sa_user(combined_db):
    return await create_app_user(combined_db, "sa@test.com", "pass", "super_admin")


@pytest.fixture
async def admin_app_user(combined_db):
    return await create_app_user(combined_db, "admin@test.com", "pass", "admin")


@pytest.fixture
async def operator_app_user(combined_db):
    return await create_app_user(combined_db, "operator@test.com", "pass", "operator")


@pytest.fixture
async def viewer_app_user(combined_db):
    return await create_app_user(combined_db, "viewer@test.com", "pass", "viewer")


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# RBAC tests for /radius/users
# ---------------------------------------------------------------------------


class TestRadiusUsersRBAC:
    async def test_viewer_can_list_users(
        self, radius_client: AsyncClient, viewer_app_user
    ):
        """GET /radius/users with viewer token → 200."""
        token = await get_token(radius_client, "viewer@test.com", "pass")
        resp = await radius_client.get(
            "/api/v1/radius/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    async def test_viewer_cannot_create_user(
        self, radius_client: AsyncClient, viewer_app_user
    ):
        """POST /radius/users with viewer token → 403."""
        token = await get_token(radius_client, "viewer@test.com", "pass")
        resp = await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "blocked", "password": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    async def test_operator_can_create_user(
        self, radius_client: AsyncClient, operator_app_user
    ):
        """POST /radius/users with operator token → 201."""
        token = await get_token(radius_client, "operator@test.com", "pass")
        resp = await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "newuser", "password": "pass123"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["username"] == "newuser"

    async def test_operator_cannot_delete_user(
        self, radius_client: AsyncClient, operator_app_user
    ):
        """DELETE /radius/users/{username} with operator token → 403."""
        # First create via admin
        token = await get_token(radius_client, "operator@test.com", "pass")
        # Create user first
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "todelete", "password": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await radius_client.delete(
            "/api/v1/radius/users/todelete",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    async def test_admin_can_delete_user(
        self, radius_client: AsyncClient, admin_app_user, operator_app_user
    ):
        """DELETE /radius/users/{username} with admin token → 204."""
        op_token = await get_token(radius_client, "operator@test.com", "pass")
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "victim", "password": "x"},
            headers={"Authorization": f"Bearer {op_token}"},
        )
        admin_token = await get_token(radius_client, "admin@test.com", "pass")
        resp = await radius_client.delete(
            "/api/v1/radius/users/victim",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 204

    async def test_unauthenticated_returns_4xx(self, radius_client: AsyncClient):
        """No token → 401 or 403 (HTTPBearer returns 403 when no credentials provided)."""
        resp = await radius_client.get("/api/v1/radius/users")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# RBAC tests for /nas
# ---------------------------------------------------------------------------


class TestNasRBAC:
    async def test_operator_cannot_manage_nas(
        self, radius_client: AsyncClient, operator_app_user
    ):
        """POST /nas with operator token → 403."""
        token = await get_token(radius_client, "operator@test.com", "pass")
        resp = await radius_client.post(
            "/api/v1/nas",
            json={"nasname": "192.168.1.1", "secret": "s"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    async def test_admin_can_manage_nas(
        self, radius_client: AsyncClient, admin_app_user
    ):
        """POST /nas with admin token → 201."""
        token = await get_token(radius_client, "admin@test.com", "pass")
        resp = await radius_client.post(
            "/api/v1/nas",
            json={"nasname": "10.0.0.1", "secret": "mysecret"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["nas"]["nasname"] == "10.0.0.1"
        # Secret must NOT be exposed in response
        assert "secret_masked" in data["nas"]
        assert data["nas"]["secret_masked"] == "***"


# ---------------------------------------------------------------------------
# Functional tests
# ---------------------------------------------------------------------------


class TestRadiusUsersFunctional:
    async def test_list_users_search_param(
        self, radius_client: AsyncClient, operator_app_user
    ):
        """GET /radius/users?search=alice returns only alice."""
        token = await get_token(radius_client, "operator@test.com", "pass")
        # Create two users
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "alice", "password": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "bob", "password": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await radius_client.get(
            "/api/v1/radius/users?search=alice",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["username"] == "alice"

    async def test_disable_enable_user(
        self, radius_client: AsyncClient, operator_app_user
    ):
        """POST /radius/users/{username}/disable then /enable cycles disabled flag."""
        token = await get_token(radius_client, "operator@test.com", "pass")
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "cycleme", "password": "x"},
            headers={"Authorization": f"Bearer {token}"},
        )

        disable_resp = await radius_client.post(
            "/api/v1/radius/users/cycleme/disable",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert disable_resp.status_code == 200
        assert disable_resp.json()["disabled"] is True

        enable_resp = await radius_client.post(
            "/api/v1/radius/users/cycleme/enable",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert enable_resp.status_code == 200
        assert enable_resp.json()["disabled"] is False

    async def test_get_user_returns_404_if_not_exists(
        self, radius_client: AsyncClient, viewer_app_user
    ):
        """GET /radius/users/nonexistent → 404."""
        token = await get_token(radius_client, "viewer@test.com", "pass")
        resp = await radius_client.get(
            "/api/v1/radius/users/nonexistent_xyz",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


class TestNasFunctional:
    async def test_nas_secret_not_in_list(
        self, radius_client: AsyncClient, admin_app_user
    ):
        """GET /nas items have secret_masked, no raw secret exposed."""
        token = await get_token(radius_client, "admin@test.com", "pass")
        await radius_client.post(
            "/api/v1/nas",
            json={"nasname": "172.16.0.1", "secret": "exposed_secret"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = await radius_client.get(
            "/api/v1/nas",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item.get("secret_masked") == "***"
            # raw secret key should not be present (or should not contain actual secret)
            assert item.get("secret") != "exposed_secret"

    async def test_nas_secret_endpoint_returns_secret(
        self, radius_client: AsyncClient, admin_app_user
    ):
        """GET /nas/{id}/secret returns the raw secret for admin."""
        token = await get_token(radius_client, "admin@test.com", "pass")
        create_resp = await radius_client.post(
            "/api/v1/nas",
            json={"nasname": "10.5.5.5", "secret": "revealme"},
            headers={"Authorization": f"Bearer {token}"},
        )
        nas_id = create_resp.json()["nas"]["id"]

        secret_resp = await radius_client.get(
            f"/api/v1/nas/{nas_id}/secret",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert secret_resp.status_code == 200
        assert secret_resp.json()["secret"] == "revealme"


class TestRadiusGroupsFunctional:
    async def test_create_and_list_groups(
        self, radius_client: AsyncClient, operator_app_user, viewer_app_user
    ):
        """POST creates group, GET lists it."""
        op_token = await get_token(radius_client, "operator@test.com", "pass")
        create_resp = await radius_client.post(
            "/api/v1/radius/groups",
            json={"groupname": "wifi-users", "check_attrs": [], "reply_attrs": []},
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert create_resp.status_code == 201

        viewer_token = await get_token(radius_client, "viewer@test.com", "pass")
        list_resp = await radius_client.get(
            "/api/v1/radius/groups",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        assert list_resp.status_code == 200

    async def test_viewer_cannot_create_group(
        self, radius_client: AsyncClient, viewer_app_user
    ):
        """POST /radius/groups with viewer → 403."""
        token = await get_token(radius_client, "viewer@test.com", "pass")
        resp = await radius_client.post(
            "/api/v1/radius/groups",
            json={"groupname": "nope"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    async def test_group_members_endpoint(
        self, radius_client: AsyncClient, operator_app_user, viewer_app_user
    ):
        """GET /radius/groups/{groupname}/members returns member list."""
        op_token = await get_token(radius_client, "operator@test.com", "pass")

        # Create group and user, then assign
        await radius_client.post(
            "/api/v1/radius/groups",
            json={"groupname": "vip-grp"},
            headers={"Authorization": f"Bearer {op_token}"},
        )
        await radius_client.post(
            "/api/v1/radius/users",
            json={"username": "member1", "password": "x"},
            headers={"Authorization": f"Bearer {op_token}"},
        )
        await radius_client.post(
            "/api/v1/radius/groups/vip-grp/members",
            json={"username": "member1", "groupname": "vip-grp", "priority": 1},
            headers={"Authorization": f"Bearer {op_token}"},
        )

        viewer_token = await get_token(radius_client, "viewer@test.com", "pass")
        members_resp = await radius_client.get(
            "/api/v1/radius/groups/vip-grp/members",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        assert members_resp.status_code == 200
        members = members_resp.json()
        assert any(m["username"] == "member1" for m in members)
