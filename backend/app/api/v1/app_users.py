from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.app import AppUser
from app.schemas.app_users import AppUserResponse, CreateUserRequest, UpdateUserRequest
from app.services.user_service import (
    create_user,
    delete_user,
    get_user_by_id,
    get_users,
    update_user,
)

router = APIRouter(prefix="/admin/users", tags=["app-users"])
SuperAdminRequired = Depends(require_role("super_admin"))


@router.get("", response_model=list[AppUserResponse])
async def list_users(
    _: Annotated[AppUser, SuperAdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await get_users(db)


@router.post("", response_model=AppUserResponse, status_code=status.HTTP_201_CREATED)
async def create_app_user(
    request: CreateUserRequest,
    _: Annotated[AppUser, SuperAdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await create_user(db, request.email, request.password, request.role)


@router.get("/{user_id}", response_model=AppUserResponse)
async def get_app_user(
    user_id: UUID,
    _: Annotated[AppUser, SuperAdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=AppUserResponse)
async def update_app_user(
    user_id: UUID,
    request: UpdateUserRequest,
    _: Annotated[AppUser, SuperAdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    updates = request.model_dump(exclude_none=True)
    return await update_user(db, user, **updates)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app_user(
    user_id: UUID,
    current_user: Annotated[AppUser, SuperAdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if str(current_user.id) == str(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete own account"
        )
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await delete_user(db, user)
