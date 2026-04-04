"""RADIUS group management endpoints.

Prefix: /radius/groups
RBAC:
  - viewer+   : GET (list, get, members)
  - operator+ : POST (create, assign member), PUT (update), DELETE member
  - admin+    : DELETE group
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.app import AppUser
from app.schemas.radius import (
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    PaginatedResponse,
    RadUserGroupCreate,
    RadUserGroupOut,
)
from app.services.radius_service import RadiusGroupService

router = APIRouter()

ViewerRequired = Depends(require_role("viewer", "operator", "admin", "super_admin"))
OperatorRequired = Depends(require_role("operator", "admin", "super_admin"))
AdminRequired = Depends(require_role("admin", "super_admin"))


@router.get("", response_model=PaginatedResponse[GroupResponse])
async def list_radius_groups(
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await RadiusGroupService.list_groups(db, search=search, page=page, page_size=page_size)


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_radius_group(
    data: GroupCreate,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusGroupService.create_group(db, data)


@router.get("/{groupname}", response_model=GroupResponse)
async def get_radius_group(
    groupname: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.radius import RadGroupCheck, RadGroupReply
    from sqlalchemy import select, union

    # Check group exists in either table
    check_q = select(RadGroupCheck.groupname).where(RadGroupCheck.groupname == groupname).limit(1)
    reply_q = select(RadGroupReply.groupname).where(RadGroupReply.groupname == groupname).limit(1)
    check_res = await db.execute(check_q)
    reply_res = await db.execute(reply_q)
    if check_res.scalar_one_or_none() is None and reply_res.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group '{groupname}' not found")
    return await RadiusGroupService.get_group(db, groupname)


@router.put("/{groupname}", response_model=GroupResponse)
async def update_radius_group(
    groupname: str,
    data: GroupUpdate,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusGroupService.update_group(db, groupname, data)


@router.delete("/{groupname}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_radius_group(
    groupname: str,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RadiusGroupService.delete_group(db, groupname)


@router.get("/{groupname}/members", response_model=list[RadUserGroupOut])
async def get_group_members(
    groupname: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusGroupService.get_group_members(db, groupname)


@router.post("/{groupname}/members", response_model=RadUserGroupOut, status_code=status.HTTP_201_CREATED)
async def assign_user_to_group(
    groupname: str,
    data: RadUserGroupCreate,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Ensure groupname in path matches body
    membership_data = RadUserGroupCreate(
        username=data.username,
        groupname=groupname,
        priority=data.priority,
    )
    return await RadiusGroupService.assign_user_to_group(db, membership_data)


@router.delete("/{groupname}/members/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_from_group(
    groupname: str,
    username: str,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RadiusGroupService.remove_user_from_group(db, username, groupname)
