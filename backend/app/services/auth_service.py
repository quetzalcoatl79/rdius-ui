from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.app import AppUser


async def authenticate_user(db: AsyncSession, email: str, password: str) -> AppUser | None:
    result = await db.execute(
        select(AppUser).where(AppUser.email == email, AppUser.is_active == True)  # noqa: E712
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
