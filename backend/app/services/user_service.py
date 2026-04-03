from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.app import AppUser


async def create_user(db: AsyncSession, email: str, password: str, role: str) -> AppUser:
    user = AppUser(email=email, hashed_password=hash_password(password), role=role)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def get_users(db: AsyncSession) -> list[AppUser]:
    result = await db.execute(select(AppUser).order_by(AppUser.created_at.desc()))
    return list(result.scalars().all())


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> AppUser | None:
    result = await db.execute(select(AppUser).where(AppUser.id == user_id))
    return result.scalar_one_or_none()


async def update_user(db: AsyncSession, user: AppUser, **kwargs) -> AppUser:
    for key, value in kwargs.items():
        if value is not None:
            setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def delete_user(db: AsyncSession, user: AppUser) -> None:
    await db.delete(user)
    await db.commit()
