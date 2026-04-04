"""RADIUS user management endpoints.

Prefix: /radius/users
RBAC:
  - viewer+   : GET (list, get, auth-history, sessions, effective-policy)
  - operator+ : POST (create, disable, enable), PUT (update)
  - admin+    : DELETE
"""

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.app import AppUser
from app.schemas.radius import (
    EffectivePolicyResponse,
    PaginatedResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.radius_service import RadiusUserService

router = APIRouter()

ViewerRequired = Depends(require_role("viewer", "operator", "admin", "super_admin"))
OperatorRequired = Depends(require_role("operator", "admin", "super_admin"))
AdminRequired = Depends(require_role("admin", "super_admin"))


@router.get("", response_model=PaginatedResponse[UserResponse])
async def list_radius_users(
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await RadiusUserService.list_users(db, search=search, page=page, page_size=page_size)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_radius_user(
    data: UserCreate,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusUserService.create_user(db, data)


@router.get("/{username}", response_model=UserResponse)
async def get_radius_user(
    username: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.radius import RadCheck
    from sqlalchemy import select

    result = await db.execute(select(RadCheck).where(RadCheck.username == username).limit(1))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User '{username}' not found")
    return await RadiusUserService.get_user(db, username)


@router.put("/{username}", response_model=UserResponse)
async def update_radius_user(
    username: str,
    data: UserUpdate,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusUserService.update_user(db, username, data)


@router.delete("/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_radius_user(
    username: str,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await RadiusUserService.delete_user(db, username)


@router.post("/{username}/disable", response_model=UserResponse)
async def disable_radius_user(
    username: str,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusUserService.disable_user(db, username)


@router.post("/{username}/enable", response_model=UserResponse)
async def enable_radius_user(
    username: str,
    _: Annotated[AppUser, OperatorRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusUserService.enable_user(db, username)


@router.get("/{username}/auth-history")
async def get_user_auth_history(
    username: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await RadiusUserService.get_user_auth_history(db, username, page=page, page_size=page_size)


@router.get("/{username}/sessions")
async def get_user_sessions(
    username: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await RadiusUserService.get_user_sessions(db, username, page=page, page_size=page_size)


@router.get("/{username}/effective-policy", response_model=EffectivePolicyResponse)
async def get_user_effective_policy(
    username: str,
    _: Annotated[AppUser, ViewerRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await RadiusUserService.get_effective_policy(db, username)
