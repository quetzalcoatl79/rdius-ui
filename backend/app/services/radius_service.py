"""Service layer for RADIUS user, group, and NAS management.

All DB operations use async SQLAlchemy sessions. No FK constraints on RADIUS
tables — relationships are managed explicitly here.

NAS secrets are NEVER returned in list/get operations — only via get_nas_secret.
"""

import logging
from typing import Optional

import httpx
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.radius import (
    Nas,
    RadAcct,
    RadCheck,
    RadGroupCheck,
    RadGroupReply,
    RadPostAuth,
    RadReply,
    RadUserGroup,
)
from app.schemas.radius import (
    AuthHistoryEntry,
    EffectivePolicyEntry,
    EffectivePolicyResponse,
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    NasCreate,
    NasMutationResponse,
    NasResponse,
    NasResponseWithSecret,
    NasUpdate,
    PaginatedResponse,
    RadGroupCheckOut,
    RadGroupReplyOut,
    RadUserGroupCreate,
    RadUserGroupOut,
    SessionEntry,
    UserCreate,
    UserResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)


class RadiusUserService:
    """Operations on RADIUS users (radcheck, radreply, radusergroup)."""

    @staticmethod
    async def create_user(db: AsyncSession, data: UserCreate) -> UserResponse:
        """Insert Cleartext-Password check attr + optional reply attrs atomically."""
        # Check if user already exists
        existing = await db.execute(
            select(RadCheck).where(RadCheck.username == data.username).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User '{data.username}' already exists",
            )

        async with db.begin_nested():
            password_row = RadCheck(
                username=data.username,
                attribute="Cleartext-Password",
                op=":=",
                value=data.password,
            )
            db.add(password_row)
            for reply_attr in data.reply_attrs:
                db.add(
                    RadReply(
                        username=data.username,
                        attribute=reply_attr.attribute,
                        op=reply_attr.op,
                        value=reply_attr.value,
                    )
                )

        await db.commit()
        return await RadiusUserService.get_user(db, data.username)

    @staticmethod
    async def get_user(db: AsyncSession, username: str) -> UserResponse:
        """Return UserResponse with check_attrs, reply_attrs, groups list, disabled flag."""
        check_result = await db.execute(
            select(RadCheck).where(RadCheck.username == username)
        )
        check_attrs = list(check_result.scalars().all())

        reply_result = await db.execute(
            select(RadReply).where(RadReply.username == username)
        )
        reply_attrs = list(reply_result.scalars().all())

        group_result = await db.execute(
            select(RadUserGroup).where(RadUserGroup.username == username).order_by(RadUserGroup.priority)
        )
        groups = [row.groupname for row in group_result.scalars().all()]

        disabled = any(
            c.attribute == "Auth-Type" and c.value == "Reject"
            for c in check_attrs
        )

        return UserResponse(
            username=username,
            check_attrs=check_attrs,
            reply_attrs=reply_attrs,
            groups=groups,
            disabled=disabled,
        )

    @staticmethod
    async def list_users(
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedResponse[UserResponse]:
        """Return paginated list of distinct usernames from radcheck.

        SQLite uses LIKE (case-insensitive by default for ASCII), PostgreSQL uses ILIKE.
        We use the func.lower() approach for portable case-insensitive search.
        """
        # Subquery: distinct usernames from radcheck matching search
        base_query = select(RadCheck.username).distinct()
        if search:
            base_query = base_query.where(
                func.lower(RadCheck.username).contains(search.lower())
            )

        count_result = await db.execute(
            select(func.count()).select_from(base_query.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        paged_result = await db.execute(
            base_query.order_by(RadCheck.username).offset(offset).limit(page_size)
        )
        usernames = list(paged_result.scalars().all())

        items = [await RadiusUserService.get_user(db, uname) for uname in usernames]

        return PaginatedResponse[UserResponse](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def update_user(db: AsyncSession, username: str, data: UserUpdate) -> UserResponse:
        """Atomically replace password and/or reply attrs."""
        from fastapi import HTTPException, status

        # Check user exists
        existing = await db.execute(
            select(RadCheck).where(RadCheck.username == username).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found")

        async with db.begin_nested():
            if data.password is not None:
                # Update Cleartext-Password value
                pass_result = await db.execute(
                    select(RadCheck).where(
                        RadCheck.username == username,
                        RadCheck.attribute == "Cleartext-Password",
                    )
                )
                pass_row = pass_result.scalar_one_or_none()
                if pass_row:
                    pass_row.value = data.password
                else:
                    db.add(RadCheck(username=username, attribute="Cleartext-Password", op=":=", value=data.password))

            if data.reply_attrs is not None:
                # Delete existing reply attrs (except any system ones)
                await db.execute(
                    delete(RadReply).where(RadReply.username == username)
                )
                for attr in data.reply_attrs:
                    db.add(RadReply(username=username, attribute=attr.attribute, op=attr.op, value=attr.value))

        await db.commit()
        return await RadiusUserService.get_user(db, username)

    @staticmethod
    async def delete_user(db: AsyncSession, username: str) -> None:
        """Delete all RadCheck, RadReply, and RadUserGroup rows for username."""
        async with db.begin_nested():
            await db.execute(delete(RadCheck).where(RadCheck.username == username))
            await db.execute(delete(RadReply).where(RadReply.username == username))
            await db.execute(delete(RadUserGroup).where(RadUserGroup.username == username))
        await db.commit()

    @staticmethod
    async def disable_user(db: AsyncSession, username: str) -> UserResponse:
        """Add Auth-Type := Reject row if not already present."""
        # Check if already disabled
        existing = await db.execute(
            select(RadCheck).where(
                RadCheck.username == username,
                RadCheck.attribute == "Auth-Type",
                RadCheck.value == "Reject",
            )
        )
        if existing.scalar_one_or_none() is None:
            async with db.begin_nested():
                db.add(
                    RadCheck(username=username, attribute="Auth-Type", op=":=", value="Reject")
                )
            await db.commit()
        return await RadiusUserService.get_user(db, username)

    @staticmethod
    async def enable_user(db: AsyncSession, username: str) -> UserResponse:
        """Remove Auth-Type := Reject row to re-enable the user."""
        async with db.begin_nested():
            await db.execute(
                delete(RadCheck).where(
                    RadCheck.username == username,
                    RadCheck.attribute == "Auth-Type",
                    RadCheck.value == "Reject",
                )
            )
        await db.commit()
        return await RadiusUserService.get_user(db, username)

    @staticmethod
    async def get_user_auth_history(
        db: AsyncSession,
        username: str,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedResponse[AuthHistoryEntry]:
        """Return paginated RadPostAuth rows ordered by authdate DESC."""
        base = select(RadPostAuth).where(RadPostAuth.username == username)

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            base.order_by(RadPostAuth.authdate.desc()).offset(offset).limit(page_size)
        )
        rows = list(result.scalars().all())

        return PaginatedResponse[AuthHistoryEntry](
            items=rows,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def get_user_sessions(
        db: AsyncSession,
        username: str,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedResponse[SessionEntry]:
        """Return paginated RadAcct rows ordered by AcctStartTime DESC."""
        base = select(RadAcct).where(RadAcct.username == username)

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(
            base.order_by(RadAcct.acct_start_time.desc()).offset(offset).limit(page_size)
        )
        rows = list(result.scalars().all())

        return PaginatedResponse[SessionEntry](
            items=rows,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def get_effective_policy(db: AsyncSession, username: str) -> EffectivePolicyResponse:
        """Merge user radcheck/radreply + group radgroupcheck/radgroupreply via priority.

        Lower priority number = applied first. User attrs are treated as priority 0
        (highest precedence) and override group attrs with the same attribute name.
        """
        policy: list[EffectivePolicyEntry] = []

        # User's own check attrs (priority 0)
        check_result = await db.execute(
            select(RadCheck).where(RadCheck.username == username)
        )
        for row in check_result.scalars().all():
            policy.append(
                EffectivePolicyEntry(
                    source="user",
                    attribute=row.attribute,
                    op=row.op,
                    value=row.value,
                    priority=0,
                )
            )

        # User's own reply attrs (priority 0)
        reply_result = await db.execute(
            select(RadReply).where(RadReply.username == username)
        )
        for row in reply_result.scalars().all():
            policy.append(
                EffectivePolicyEntry(
                    source="user",
                    attribute=row.attribute,
                    op=row.op,
                    value=row.value,
                    priority=0,
                )
            )

        # Group attrs ordered by radusergroup priority
        group_result = await db.execute(
            select(RadUserGroup)
            .where(RadUserGroup.username == username)
            .order_by(RadUserGroup.priority)
        )
        for membership in group_result.scalars().all():
            gc_result = await db.execute(
                select(RadGroupCheck).where(RadGroupCheck.groupname == membership.groupname)
            )
            for row in gc_result.scalars().all():
                policy.append(
                    EffectivePolicyEntry(
                        source=membership.groupname,
                        attribute=row.attribute,
                        op=row.op,
                        value=row.value,
                        priority=membership.priority,
                    )
                )

            gr_result = await db.execute(
                select(RadGroupReply).where(RadGroupReply.groupname == membership.groupname)
            )
            for row in gr_result.scalars().all():
                policy.append(
                    EffectivePolicyEntry(
                        source=membership.groupname,
                        attribute=row.attribute,
                        op=row.op,
                        value=row.value,
                        priority=membership.priority,
                    )
                )

        # Sort: priority ASC, then source (user first), then attribute name
        policy.sort(key=lambda e: (e.priority, e.source != "user", e.attribute))

        return EffectivePolicyResponse(username=username, policy=policy)


class RadiusGroupService:
    """Operations on RADIUS groups (radgroupcheck, radgroupreply, radusergroup)."""

    @staticmethod
    async def create_group(db: AsyncSession, data: GroupCreate) -> GroupResponse:
        """Insert group check and reply attributes."""
        async with db.begin_nested():
            for attr in data.check_attrs:
                db.add(
                    RadGroupCheck(
                        groupname=data.groupname,
                        attribute=attr.attribute,
                        op=attr.op,
                        value=attr.value,
                    )
                )
            for attr in data.reply_attrs:
                db.add(
                    RadGroupReply(
                        groupname=data.groupname,
                        attribute=attr.attribute,
                        op=attr.op,
                        value=attr.value,
                    )
                )
        await db.commit()
        return await RadiusGroupService.get_group(db, data.groupname)

    @staticmethod
    async def get_group(db: AsyncSession, groupname: str) -> GroupResponse:
        """Return group with check_attrs, reply_attrs, and member list."""
        check_result = await db.execute(
            select(RadGroupCheck).where(RadGroupCheck.groupname == groupname)
        )
        reply_result = await db.execute(
            select(RadGroupReply).where(RadGroupReply.groupname == groupname)
        )
        members_result = await db.execute(
            select(RadUserGroup).where(RadUserGroup.groupname == groupname)
        )
        members = [row.username for row in members_result.scalars().all()]

        return GroupResponse(
            groupname=groupname,
            check_attrs=list(check_result.scalars().all()),
            reply_attrs=list(reply_result.scalars().all()),
            members=members,
        )

    @staticmethod
    async def list_groups(
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedResponse[GroupResponse]:
        """Return distinct group names from radgroupcheck UNION radgroupreply."""
        from sqlalchemy import union

        check_names = select(RadGroupCheck.groupname.label("groupname")).distinct()
        reply_names = select(RadGroupReply.groupname.label("groupname")).distinct()
        combined = union(check_names, reply_names).subquery()

        if search:
            base = select(combined.c.groupname).where(
                func.lower(combined.c.groupname).contains(search.lower())
            )
        else:
            base = select(combined.c.groupname)

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        paged = await db.execute(
            base.order_by(combined.c.groupname).offset(offset).limit(page_size)
        )
        groupnames = list(paged.scalars().all())

        items = [await RadiusGroupService.get_group(db, gname) for gname in groupnames]

        return PaginatedResponse[GroupResponse](
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def update_group(db: AsyncSession, groupname: str, data: GroupUpdate) -> GroupResponse:
        """Atomically replace group check and/or reply attrs."""
        async with db.begin_nested():
            if data.check_attrs is not None:
                await db.execute(
                    delete(RadGroupCheck).where(RadGroupCheck.groupname == groupname)
                )
                for attr in data.check_attrs:
                    db.add(
                        RadGroupCheck(
                            groupname=groupname,
                            attribute=attr.attribute,
                            op=attr.op,
                            value=attr.value,
                        )
                    )
            if data.reply_attrs is not None:
                await db.execute(
                    delete(RadGroupReply).where(RadGroupReply.groupname == groupname)
                )
                for attr in data.reply_attrs:
                    db.add(
                        RadGroupReply(
                            groupname=groupname,
                            attribute=attr.attribute,
                            op=attr.op,
                            value=attr.value,
                        )
                    )
        await db.commit()
        return await RadiusGroupService.get_group(db, groupname)

    @staticmethod
    async def delete_group(db: AsyncSession, groupname: str) -> None:
        """Delete RadGroupCheck, RadGroupReply, and RadUserGroup rows for group."""
        async with db.begin_nested():
            await db.execute(delete(RadGroupCheck).where(RadGroupCheck.groupname == groupname))
            await db.execute(delete(RadGroupReply).where(RadGroupReply.groupname == groupname))
            await db.execute(delete(RadUserGroup).where(RadUserGroup.groupname == groupname))
        await db.commit()

    @staticmethod
    async def assign_user_to_group(
        db: AsyncSession, data: RadUserGroupCreate
    ) -> RadUserGroupOut:
        """Upsert RadUserGroup row (delete existing then insert)."""
        async with db.begin_nested():
            await db.execute(
                delete(RadUserGroup).where(
                    RadUserGroup.username == data.username,
                    RadUserGroup.groupname == data.groupname,
                )
            )
            row = RadUserGroup(
                username=data.username,
                groupname=data.groupname,
                priority=data.priority,
            )
            db.add(row)
        await db.commit()
        await db.refresh(row)
        return RadUserGroupOut.model_validate(row)

    @staticmethod
    async def remove_user_from_group(db: AsyncSession, username: str, groupname: str) -> None:
        """Delete RadUserGroup row for (username, groupname)."""
        async with db.begin_nested():
            await db.execute(
                delete(RadUserGroup).where(
                    RadUserGroup.username == username,
                    RadUserGroup.groupname == groupname,
                )
            )
        await db.commit()

    @staticmethod
    async def get_group_members(db: AsyncSession, groupname: str) -> list[RadUserGroupOut]:
        """Return list of RadUserGroupOut for group members."""
        result = await db.execute(
            select(RadUserGroup)
            .where(RadUserGroup.groupname == groupname)
            .order_by(RadUserGroup.priority, RadUserGroup.username)
        )
        return [RadUserGroupOut.model_validate(row) for row in result.scalars().all()]


class NasService:
    """Operations on NAS clients (nas table). Secrets are masked in all list/get ops."""

    @staticmethod
    async def create_nas(db: AsyncSession, data: NasCreate) -> NasMutationResponse:
        """Insert Nas row and return NasResponse (secret masked) + restart status."""
        async with db.begin_nested():
            row = Nas(
                nasname=data.nasname,
                shortname=data.shortname,
                type=data.type,
                ports=data.ports,
                secret=data.secret,
                server=data.server,
                community=data.community,
                description=data.description,
            )
            db.add(row)
        await db.commit()
        await db.refresh(row)
        return NasMutationResponse(
            nas=NasResponse.from_nas(row),
            restart_triggered=False,
        )

    @staticmethod
    async def get_nas(db: AsyncSession, nas_id: int) -> Optional[NasResponse]:
        """Return NasResponse with masked secret, or None if not found."""
        result = await db.execute(select(Nas).where(Nas.id == nas_id))
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return NasResponse.from_nas(row)

    @staticmethod
    async def list_nas(
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
    ) -> PaginatedResponse[NasResponse]:
        """Return paginated NasResponse list with masked secrets."""
        base = select(Nas)
        if search:
            base = base.where(
                or_(
                    func.lower(Nas.nasname).contains(search.lower()),
                    func.lower(Nas.shortname).contains(search.lower()),
                )
            )

        count_result = await db.execute(
            select(func.count()).select_from(base.subquery())
        )
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        result = await db.execute(base.order_by(Nas.nasname).offset(offset).limit(page_size))
        rows = list(result.scalars().all())

        return PaginatedResponse[NasResponse](
            items=[NasResponse.from_nas(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    @staticmethod
    async def update_nas(db: AsyncSession, nas_id: int, data: NasUpdate) -> Optional[NasMutationResponse]:
        """Update Nas row fields. Returns None if not found."""
        result = await db.execute(select(Nas).where(Nas.id == nas_id))
        row = result.scalar_one_or_none()
        if row is None:
            return None

        async with db.begin_nested():
            for field, value in data.model_dump(exclude_none=True).items():
                setattr(row, field, value)

        await db.commit()
        await db.refresh(row)
        return NasMutationResponse(
            nas=NasResponse.from_nas(row),
            restart_triggered=False,
        )

    @staticmethod
    async def delete_nas(db: AsyncSession, nas_id: int) -> bool:
        """Delete Nas row. Returns True if deleted, False if not found."""
        result = await db.execute(select(Nas).where(Nas.id == nas_id))
        row = result.scalar_one_or_none()
        if row is None:
            return False
        async with db.begin_nested():
            await db.delete(row)
        await db.commit()
        return True

    @staticmethod
    async def get_nas_secret(db: AsyncSession, nas_id: int) -> Optional[NasResponseWithSecret]:
        """Return NasResponseWithSecret with raw secret — only for explicit admin reveal."""
        result = await db.execute(select(Nas).where(Nas.id == nas_id))
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return NasResponseWithSecret.model_validate(row)

    @staticmethod
    async def trigger_freeradius_restart(
        docker_socket_url: str,
        container_label: str,
    ) -> bool:
        """Send restart command to FreeRADIUS container via Docker socket proxy.

        Returns True if restart was triggered, False/raises on failure.
        Raises HTTPException 503 if the Docker socket is unreachable.
        """
        from fastapi import HTTPException, status

        try:
            async with httpx.AsyncClient(base_url=docker_socket_url, timeout=5.0) as client:
                # Discover container by label
                filters = f'{{"label":["{container_label}"]}}'
                resp = await client.get(f"/containers/json?filters={filters}")
                if resp.status_code != 200 or not resp.json():
                    logger.warning(
                        "FreeRADIUS container not found (label=%s). Restart skipped.", container_label
                    )
                    return False
                container_id = resp.json()[0]["Id"]
                restart_resp = await client.post(f"/containers/{container_id}/restart")
                if restart_resp.status_code not in (200, 204):
                    logger.warning("Restart returned status %s", restart_resp.status_code)
                    return False
                logger.info("FreeRADIUS container %s restarted.", container_id[:12])
                return True
        except httpx.HTTPError as exc:
            logger.error("Docker socket error during FreeRADIUS restart: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="FreeRADIUS restart failed — Docker socket unreachable",
            )
