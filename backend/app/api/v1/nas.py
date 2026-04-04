"""NAS (Network Access Server) management endpoints.

Prefix: /nas
RBAC: All NAS endpoints require admin+ role.
NAS secrets are masked by default; explicit /secret endpoint for admin reveal.
All mutating operations (create/update/delete) trigger FreeRADIUS restart.
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.core.config import settings
from app.models.app import AppUser
from app.schemas.radius import (
    NasCreate,
    NasMutationResponse,
    NasResponse,
    NasResponseWithSecret,
    NasUpdate,
    PaginatedResponse,
)
from app.services.radius_service import NasService

logger = logging.getLogger(__name__)

router = APIRouter()

AdminRequired = Depends(require_role("admin", "super_admin"))


@router.get("", response_model=PaginatedResponse[NasResponse])
async def list_nas(
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    return await NasService.list_nas(db, search=search, page=page, page_size=page_size)


@router.post("", response_model=NasMutationResponse, status_code=status.HTTP_201_CREATED)
async def create_nas(
    data: NasCreate,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await NasService.create_nas(db, data)
    restart_ok = await _try_restart()
    result.restart_triggered = restart_ok
    return result


@router.get("/{nas_id}", response_model=NasResponse)
async def get_nas(
    nas_id: int,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    nas = await NasService.get_nas(db, nas_id)
    if nas is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"NAS {nas_id} not found")
    return nas


@router.put("/{nas_id}", response_model=NasMutationResponse)
async def update_nas(
    nas_id: int,
    data: NasUpdate,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await NasService.update_nas(db, nas_id, data)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"NAS {nas_id} not found")
    restart_ok = await _try_restart()
    result.restart_triggered = restart_ok
    return result


@router.delete("/{nas_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_nas(
    nas_id: int,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    deleted = await NasService.delete_nas(db, nas_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"NAS {nas_id} not found")
    await _try_restart()


@router.get("/{nas_id}/secret", response_model=NasResponseWithSecret)
async def get_nas_secret(
    nas_id: int,
    _: Annotated[AppUser, AdminRequired],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Return NAS with raw secret. Only accessible to admin and super_admin."""
    nas = await NasService.get_nas_secret(db, nas_id)
    if nas is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"NAS {nas_id} not found")
    return nas


async def _try_restart() -> bool:
    """Attempt to restart FreeRADIUS. Returns True on success, False on failure.

    Never raises — NAS data mutation succeeds regardless of restart outcome.
    """
    try:
        docker_url = getattr(settings, "docker_socket_url", "http://docker-socket-proxy:2375")
        container_label = getattr(
            settings, "freeradius_container_label", "radius-ui.role=freeradius"
        )
        return await NasService.trigger_freeradius_restart(docker_url, container_label)
    except Exception as exc:
        logger.warning("FreeRADIUS restart failed (non-fatal): %s", exc)
        return False
