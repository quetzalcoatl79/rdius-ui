from fastapi import APIRouter

from app.api.v1.app_users import router as app_users_router
from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.logs import router as logs_router
from app.api.v1.nas import router as nas_router
from app.api.v1.radius_groups import router as radius_groups_router
from app.api.v1.radius_users import router as radius_users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(app_users_router)
api_router.include_router(radius_users_router, prefix="/radius/users", tags=["radius-users"])
api_router.include_router(radius_groups_router, prefix="/radius/groups", tags=["radius-groups"])
api_router.include_router(nas_router, prefix="/nas", tags=["nas"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(logs_router, prefix="/logs", tags=["logs"])
