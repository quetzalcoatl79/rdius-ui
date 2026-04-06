"""Server registry API endpoints.

Provides CRUD for FreeRADIUS server registrations plus Docker/remote service control
(restart, status, health). Every mutating operation is logged to the audit trail.
"""

import asyncio
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

_admin_deps = Depends(require_role("admin", "super_admin"))
_viewer_deps = Depends(require_role("viewer", "operator", "admin", "super_admin"))


# ---------------------------------------------------------------------------
# Remote server helpers (SSH)
# ---------------------------------------------------------------------------

async def _remote_exec(host: str, port: int, user: str, cmd: str) -> tuple[bool, str]:
    """Execute a command on a remote server via SSH. Returns (success, output)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "ssh",
            "-o", "StrictHostKeyChecking=no",
            "-o", "ConnectTimeout=10",
            "-o", "BatchMode=yes",
            "-p", str(port),
            f"{user}@{host}",
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        output = stdout.decode().strip() or stderr.decode().strip()
        return proc.returncode == 0, output
    except asyncio.TimeoutError:
        return False, "SSH command timed out"
    except Exception as e:
        return False, str(e)


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


@router.post("", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    request: Request,
    data: ServerCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _admin_deps],
) -> ServerResponse:
    """Register a new FreeRADIUS server instance."""
    server = await ServerService.create_server(db, data)
    await AuditService.log(
        db=db,
        user=current_user,
        action="create",
        resource_type="server",
        resource_id=str(server.id),
        details={"name": server.name, "server_type": server.server_type},
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(server)
    return ServerResponse.model_validate(server)


@router.get("", response_model=list[ServerResponse])
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")
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
    """Restart the FreeRADIUS server (Docker container or remote via SSH)."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")

    if server.server_type == "remote":
        if not server.remote_host or not server.remote_user:
            raise HTTPException(status_code=400, detail="Remote server missing host/user configuration")
        success, output = await _remote_exec(
            server.remote_host, server.remote_port, server.remote_user,
            server.remote_restart_cmd or "sudo systemctl restart freeradius",
        )
        details = {"success": success, "type": "remote", "host": server.remote_host, "output": output}
    else:
        success = await DockerService.restart_container(server.docker_container_id)
        details = {"success": success, "type": "docker", "docker_container_id": server.docker_container_id}

    await AuditService.log(
        db=db, user=current_user, action="restart", resource_type="server",
        resource_id=str(server.id), details=details,
        ip_address=request.client.host if request.client else None,
    )
    await db.commit()

    if not success:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Server restart failed")

    return {"success": True, "message": "Restart triggered"}


# ---------------------------------------------------------------------------
# Status & health
# ---------------------------------------------------------------------------


@router.get("/{server_id}/status", response_model=ServerStatus)
async def get_server_status(
    server_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[AppUser, _viewer_deps],
) -> ServerStatus:
    """Return the running status for a server."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")

    if server.server_type == "remote":
        if not server.remote_host or not server.remote_user:
            return ServerStatus(server_id=server_id, container_status="not_configured")
        success, output = await _remote_exec(
            server.remote_host, server.remote_port, server.remote_user,
            server.remote_status_cmd or "systemctl is-active freeradius",
        )
        st = "running" if success and "active" in output.lower() else "stopped"
        return ServerStatus(server_id=server_id, container_status=st)
    else:
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
    """Return CPU and memory metrics (Docker only, returns zeros for remote)."""
    server = await ServerService.get_server(db, server_id)
    if server is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Server {server_id} not found")

    if server.server_type == "remote":
        return ServerHealth(
            server_id=server_id, cpu_percent=0, memory_usage_mb=0, memory_limit_mb=0, memory_percent=0,
        )

    health_data = await DockerService.get_container_health(server.docker_container_id)
    return ServerHealth(
        server_id=server_id,
        cpu_percent=health_data["cpu_percent"],
        memory_usage_mb=health_data["memory_usage_mb"],
        memory_limit_mb=health_data["memory_limit_mb"],
        memory_percent=health_data["memory_percent"],
    )
