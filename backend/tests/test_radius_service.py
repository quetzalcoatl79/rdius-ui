"""Tests for RADIUS service layer (RadiusUserService, RadiusGroupService, NasService).

Uses SQLite in-memory with ATTACH DATABASE for both 'app' and 'radius' schemas,
mirroring the Phase 1 pattern from conftest.py.
"""

import sqlite3

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models.app import AppBase
from app.models.radius import RadiusBase
from app.schemas.radius import (
    GroupCreate,
    NasCreate,
    RadGroupCheckCreate,
    RadGroupReplyCreate,
    RadReplyCreate,
    RadUserGroupCreate,
    UserCreate,
)
from app.services.radius_service import NasService, RadiusGroupService, RadiusUserService

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

_SHARED_RADIUS_CONN: sqlite3.Connection | None = None


def _get_radius_test_connection():
    """Return a single shared in-memory SQLite connection with 'app' and 'radius' schemas."""
    global _SHARED_RADIUS_CONN
    if _SHARED_RADIUS_CONN is None:
        _SHARED_RADIUS_CONN = sqlite3.connect(":memory:", check_same_thread=False)
        _SHARED_RADIUS_CONN.execute("ATTACH DATABASE ':memory:' AS app")
        _SHARED_RADIUS_CONN.execute("ATTACH DATABASE ':memory:' AS radius")
    return _SHARED_RADIUS_CONN


@pytest.fixture
async def radius_db_engine():
    global _SHARED_RADIUS_CONN
    _SHARED_RADIUS_CONN = None

    engine = create_async_engine(
        "sqlite+aiosqlite://",
        creator=_get_radius_test_connection,
    )

    async with engine.begin() as conn:
        await conn.run_sync(AppBase.metadata.create_all)
        await conn.run_sync(RadiusBase.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(RadiusBase.metadata.drop_all)
        await conn.run_sync(AppBase.metadata.drop_all)
    await engine.dispose()
    if _SHARED_RADIUS_CONN is not None:
        _SHARED_RADIUS_CONN.close()
        _SHARED_RADIUS_CONN = None


@pytest.fixture
async def radius_db(radius_db_engine):
    factory = async_sessionmaker(radius_db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


# ---------------------------------------------------------------------------
# RadiusUserService tests
# ---------------------------------------------------------------------------


class TestRadiusUserService:
    async def test_create_user_sets_correct_op(self, radius_db: AsyncSession):
        """create_user inserts RadCheck with op=':=' for Cleartext-Password."""
        from app.models.radius import RadCheck
        from sqlalchemy import select

        user = await RadiusUserService.create_user(
            radius_db, UserCreate(username="alice", password="secret123")
        )
        assert user.username == "alice"

        result = await radius_db.execute(
            select(RadCheck).where(
                RadCheck.username == "alice",
                RadCheck.attribute == "Cleartext-Password",
            )
        )
        row = result.scalar_one()
        assert row.op == ":="
        assert row.value == "secret123"

    async def test_create_user_returns_user_response(self, radius_db: AsyncSession):
        """create_user returns UserResponse with username and check_attrs."""
        user = await RadiusUserService.create_user(
            radius_db, UserCreate(username="bob", password="pass")
        )
        assert user.username == "bob"
        assert any(a.attribute == "Cleartext-Password" for a in user.check_attrs)
        assert user.disabled is False

    async def test_disable_user_adds_auth_type_reject(self, radius_db: AsyncSession):
        """disable_user adds Auth-Type := Reject row in radcheck."""
        from app.models.radius import RadCheck
        from sqlalchemy import select

        await RadiusUserService.create_user(radius_db, UserCreate(username="charlie", password="x"))
        user = await RadiusUserService.disable_user(radius_db, "charlie")
        assert user.disabled is True

        result = await radius_db.execute(
            select(RadCheck).where(
                RadCheck.username == "charlie",
                RadCheck.attribute == "Auth-Type",
                RadCheck.value == "Reject",
            )
        )
        row = result.scalar_one_or_none()
        assert row is not None
        assert row.op == ":="

    async def test_disable_user_does_not_delete_password(self, radius_db: AsyncSession):
        """disable_user does not remove the Cleartext-Password row."""
        from app.models.radius import RadCheck
        from sqlalchemy import select

        await RadiusUserService.create_user(radius_db, UserCreate(username="dave", password="pw"))
        await RadiusUserService.disable_user(radius_db, "dave")

        result = await radius_db.execute(
            select(RadCheck).where(
                RadCheck.username == "dave",
                RadCheck.attribute == "Cleartext-Password",
            )
        )
        assert result.scalar_one_or_none() is not None

    async def test_enable_user_removes_auth_type_reject(self, radius_db: AsyncSession):
        """enable_user removes the Auth-Type := Reject row."""
        from app.models.radius import RadCheck
        from sqlalchemy import select

        await RadiusUserService.create_user(radius_db, UserCreate(username="eve", password="pw"))
        await RadiusUserService.disable_user(radius_db, "eve")
        user = await RadiusUserService.enable_user(radius_db, "eve")
        assert user.disabled is False

        result = await radius_db.execute(
            select(RadCheck).where(
                RadCheck.username == "eve",
                RadCheck.attribute == "Auth-Type",
            )
        )
        assert result.scalar_one_or_none() is None

    async def test_list_users_search(self, radius_db: AsyncSession):
        """search='ali' returns only alice, not bob."""
        await RadiusUserService.create_user(radius_db, UserCreate(username="alice", password="x"))
        await RadiusUserService.create_user(radius_db, UserCreate(username="bob", password="x"))

        result = await RadiusUserService.list_users(radius_db, search="ali")
        assert result.total == 1
        assert result.items[0].username == "alice"

    async def test_list_users_pagination(self, radius_db: AsyncSession):
        """30 users → page=2, page_size=10 returns 10 items with total=30."""
        for i in range(30):
            await RadiusUserService.create_user(
                radius_db, UserCreate(username=f"user{i:02d}", password="x")
            )

        result = await RadiusUserService.list_users(radius_db, page=2, page_size=10)
        assert result.total == 30
        assert len(result.items) == 10
        assert result.page == 2

    async def test_delete_user_removes_all_rows(self, radius_db: AsyncSession):
        """delete_user removes RadCheck, RadReply, and RadUserGroup rows."""
        from app.models.radius import RadCheck, RadReply, RadUserGroup
        from sqlalchemy import select

        await RadiusUserService.create_user(
            radius_db,
            UserCreate(
                username="frank",
                password="x",
                reply_attrs=[
                    RadReplyCreate(username="frank", attribute="Framed-Pool", op=":=", value="p1")
                ],
            ),
        )
        # Assign to a group
        await RadiusGroupService.create_group(
            radius_db,
            GroupCreate(groupname="staff"),
        )
        await RadiusGroupService.assign_user_to_group(
            radius_db, RadUserGroupCreate(username="frank", groupname="staff")
        )

        await RadiusUserService.delete_user(radius_db, "frank")

        for model in (RadCheck, RadReply, RadUserGroup):
            col = model.username
            result = await radius_db.execute(select(model).where(col == "frank"))
            assert result.scalar_one_or_none() is None

    async def test_get_user_returns_groups(self, radius_db: AsyncSession):
        """get_user includes the groups the user belongs to."""
        await RadiusUserService.create_user(radius_db, UserCreate(username="grace", password="x"))
        await RadiusGroupService.create_group(radius_db, GroupCreate(groupname="vip"))
        await RadiusGroupService.assign_user_to_group(
            radius_db, RadUserGroupCreate(username="grace", groupname="vip")
        )

        user = await RadiusUserService.get_user(radius_db, "grace")
        assert "vip" in user.groups


# ---------------------------------------------------------------------------
# RadiusGroupService tests
# ---------------------------------------------------------------------------


class TestRadiusGroupService:
    async def test_create_group_and_get(self, radius_db: AsyncSession):
        """create_group inserts check/reply attrs and get_group returns them."""
        group = await RadiusGroupService.create_group(
            radius_db,
            GroupCreate(
                groupname="engineers",
                check_attrs=[
                    RadGroupCheckCreate(groupname="engineers", attribute="Auth-Type", op=":=", value="PAP")
                ],
                reply_attrs=[
                    RadGroupReplyCreate(groupname="engineers", attribute="Framed-Pool", op=":=", value="eng-pool")
                ],
            ),
        )
        assert group.groupname == "engineers"

        fetched = await RadiusGroupService.get_group(radius_db, "engineers")
        assert any(a.attribute == "Auth-Type" for a in fetched.check_attrs)
        assert any(a.attribute == "Framed-Pool" for a in fetched.reply_attrs)

    async def test_assign_user_to_group(self, radius_db: AsyncSession):
        """assign_user_to_group creates RadUserGroup row."""
        await RadiusGroupService.create_group(radius_db, GroupCreate(groupname="sales"))
        await RadiusUserService.create_user(radius_db, UserCreate(username="henry", password="x"))
        membership = await RadiusGroupService.assign_user_to_group(
            radius_db, RadUserGroupCreate(username="henry", groupname="sales")
        )
        assert membership.username == "henry"
        assert membership.groupname == "sales"

    async def test_get_group_members(self, radius_db: AsyncSession):
        """get_group_members returns list of RadUserGroupOut for the group."""
        await RadiusGroupService.create_group(radius_db, GroupCreate(groupname="marketing"))
        await RadiusUserService.create_user(radius_db, UserCreate(username="iris", password="x"))
        await RadiusGroupService.assign_user_to_group(
            radius_db, RadUserGroupCreate(username="iris", groupname="marketing")
        )

        members = await RadiusGroupService.get_group_members(radius_db, "marketing")
        assert len(members) == 1
        assert members[0].username == "iris"

    async def test_delete_group_removes_all_rows(self, radius_db: AsyncSession):
        """delete_group removes RadGroupCheck, RadGroupReply, and RadUserGroup rows."""
        from app.models.radius import RadGroupCheck, RadGroupReply, RadUserGroup
        from sqlalchemy import select

        await RadiusGroupService.create_group(
            radius_db,
            GroupCreate(
                groupname="temp",
                check_attrs=[RadGroupCheckCreate(groupname="temp", attribute="Auth-Type", op=":=", value="PAP")],
            ),
        )
        await RadiusUserService.create_user(radius_db, UserCreate(username="jack", password="x"))
        await RadiusGroupService.assign_user_to_group(
            radius_db, RadUserGroupCreate(username="jack", groupname="temp")
        )

        await RadiusGroupService.delete_group(radius_db, "temp")

        result = await radius_db.execute(
            select(RadGroupCheck).where(RadGroupCheck.groupname == "temp")
        )
        assert result.scalar_one_or_none() is None
        result2 = await radius_db.execute(
            select(RadUserGroup).where(RadUserGroup.groupname == "temp")
        )
        assert result2.scalar_one_or_none() is None


# ---------------------------------------------------------------------------
# NasService tests
# ---------------------------------------------------------------------------


class TestNasService:
    async def test_create_nas_returns_masked_secret(self, radius_db: AsyncSession):
        """create_nas returns NasResponse with secret_masked='***'."""
        response = await NasService.create_nas(
            radius_db, NasCreate(nasname="192.168.1.1", shortname="router1", secret="topsecret")
        )
        assert response.nas.nasname == "192.168.1.1"
        assert response.nas.secret_masked == "***"
        assert not hasattr(response.nas, "secret") or getattr(response.nas, "secret", None) != "topsecret"

    async def test_list_nas_masks_secrets(self, radius_db: AsyncSession):
        """list_nas returns NasResponse items with masked secrets."""
        await NasService.create_nas(
            radius_db, NasCreate(nasname="10.0.0.1", secret="abc")
        )
        await NasService.create_nas(
            radius_db, NasCreate(nasname="10.0.0.2", secret="def")
        )
        result = await NasService.list_nas(radius_db)
        assert result.total >= 2
        for item in result.items:
            assert item.secret_masked == "***"
            assert not hasattr(item, "secret") or getattr(item, "secret", None) not in ("abc", "def")

    async def test_list_nas_search(self, radius_db: AsyncSession):
        """search on nasname/shortname returns matching NAS entries."""
        await NasService.create_nas(
            radius_db, NasCreate(nasname="172.16.0.1", shortname="switch-A", secret="s1")
        )
        await NasService.create_nas(
            radius_db, NasCreate(nasname="172.16.0.2", shortname="router-B", secret="s2")
        )
        result = await NasService.list_nas(radius_db, search="switch")
        assert result.total == 1
        assert result.items[0].nasname == "172.16.0.1"

    async def test_get_nas_secret(self, radius_db: AsyncSession):
        """get_nas_secret returns NasResponseWithSecret with raw secret."""
        resp = await NasService.create_nas(
            radius_db, NasCreate(nasname="10.1.1.1", secret="revealed")
        )
        nas_id = resp.nas.id
        with_secret = await NasService.get_nas_secret(radius_db, nas_id)
        assert with_secret.secret == "revealed"

    async def test_delete_nas(self, radius_db: AsyncSession):
        """delete_nas removes the NAS row."""
        resp = await NasService.create_nas(
            radius_db, NasCreate(nasname="10.2.2.2", secret="bye")
        )
        nas_id = resp.nas.id
        await NasService.delete_nas(radius_db, nas_id)
        found = await NasService.get_nas(radius_db, nas_id)
        assert found is None
