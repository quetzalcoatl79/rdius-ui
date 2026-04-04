"""Server registry API endpoints.

Provides CRUD for FreeRADIUS server registrations plus Docker service control
(restart, status, health). Every mutating operation is logged to the audit trail.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.app import AppUser
from app.schemas.server import (
    ServerCreate,
    ServerHealth,
    ServerResponse,
    ServerStatus,
    ServerUpdate,
)
from app.services.audit_service import AuditService
from app.services.docker_service import DockerService
from app.services.server_service import ServerService

router = APIRouter()

# Role dependency aliases
_admin_deps = Depends(require_role("admin", "super_admin"))
_viewer_deps = Depends(require_role("viewer", "operator", "admin", "super_admin"))


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("/", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    request: Request,
    data: ServerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
) -> ServerResponse:
    """Register a new FreeRADIUS server instance (SRV-01)."""
    server = await ServerService.create_server(db, data)
    await AuditService.log(
        db=db,
        user=current_user,
        action="create",
        resource_type="server",
        resource_id=str(server.id),
        details={"name": server.name, "docker_container_id": server.docker_container_id},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(server)
    return ServerResponse.model_validate(server)


@router.get("/", response_model=list[ServerResponse])
async def list_servers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _viewer_deps],
) -> list[ServerResponse]:
    """List all active server registrations."""
    servers = await ServerService.list_servers(db)
    return [ServerResponse.model_validate(s) for s in servers]


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _viewer_deps],
) -> ServerResponse:
    """Get a single server registration by ID."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )
    return ServerResponse.model_validate(server)


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: uuid.UUID,
    request: Request,
    data: ServerUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
) -> ServerResponse:
    """Update a server registration."""
    server = await ServerService.update_server(db, server_id, data)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )
    await AuditService.log(
        db=db,
        user=current_user,
        action="update",
        resource_type="server",
        resource_id=str(server.id),
        details=data.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(server)
    return ServerResponse.model_validate(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
) -> None:
    """Delete a server registration."""
    deleted = await ServerService.delete_server(db, server_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )
    await AuditService.log(
        db=db,
        user=current_user,
        action="delete",
        resource_type="server",
        resource_id=str(server_id),
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()


# ---------------------------------------------------------------------------
# Service control
# ---------------------------------------------------------------------------


@router.post("/{server_id}/restart")
async def restart_server(
    server_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
) -> dict:
    """Restart the FreeRADIUS container associated with this server (SRV-04).

    Routes the restart signal through the Docker socket proxy.
    Logs the action to audit trail per AUDIT-04.
    """
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )

    success = await DockerService.restart_container(server.docker_container_id)

    await AuditService.log(
        db=db,
        user=current_user,
        action="restart",
        resource_type="server",
        resource_id=str(server.id),
        details={"success": success, "docker_container_id": server.docker_container_id},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    if not success:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Container restart failed — container may not be running",
        )

    return {"success": True, "message": "Container restart triggered"}


# ---------------------------------------------------------------------------
# Status & health
# ---------------------------------------------------------------------------


@router.get("/{server_id}/status", response_model=ServerStatus)
async def get_server_status(
    server_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _viewer_deps],
) -> ServerStatus:
    """Return the running status and uptime for a server's container (SRV-05)."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )

    status_data = await DockerService.get_container_status(server.docker_container_id)
    return ServerStatus(
        server_id=server_id,
        container_status=status_data.get("status", "not_found"),
        uptime_seconds=status_data.get("uptime_seconds"),
        started_at=status_data.get("started_at"),
        last_restart=status_data.get("last_restart"),
    )


@router.get("/{server_id}/health", response_model=ServerHealth)
async def get_server_health(
    server_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _viewer_deps],
) -> ServerHealth:
    """Return CPU and memory metrics for a server's container (SRV-06)."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )

    health_data = await DockerService.get_container_health(server.docker_container_id)
    return ServerHealth(
        server_id=server_id,
        cpu_percent=health_data["cpu_percent"],
        memory_usage_mb=health_data["memory_usage_mb"],
        memory_limit_mb=health_data["memory_limit_mb"],
        memory_percent=health_data["memory_percent"],
    )
