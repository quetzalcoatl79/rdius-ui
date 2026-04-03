from fastapi import APIRouter

from app.api.v1.app_users import router as app_users_router
from app.api.v1.auth import router as auth_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(app_users_router)
