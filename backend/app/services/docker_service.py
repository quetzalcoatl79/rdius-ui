"""Docker container management via socket proxy.

All Docker API calls are routed through the tecnativa/docker-socket-proxy
at settings.docker_socket_url. This service never touches the raw Docker socket.

CP-4 enforcement: only container inspection and restart signals are used.
PT-3 enforcement: stats endpoint is always called with stream=false.
"""

import json
import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)


class DockerService:
    """Static-method service for Docker container control via socket proxy."""

    @staticmethod
    async def get_container_by_label(docker_container_id: str) -> dict | None:
        """Find a container by its radius-ui.instance label value.

        Returns the first matching container dict from /containers/json,
        or None if no container matches.
        """
        filters = json.dumps({"label": [f"radius-ui.instance={docker_container_id}"]})
        try:
            async with httpx.AsyncClient(
                base_url=settings.docker_socket_url, timeout=5.0
            ) as client:
                resp = await client.get(f"/containers/json?filters={filters}")
                resp.raise_for_status()
                containers = resp.json()
                if not containers:
                    return None
                return containers[0]
        except httpx.HTTPError as exc:
            logger.error(
                "Docker socket error while looking up container '%s': %s",
                docker_container_id,
                exc,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Docker socket unavailable: {exc}",
            )

    @staticmethod
    async def restart_container(docker_container_id: str) -> bool:
        """Restart a FreeRADIUS container by its radius-ui.instance label.

        Uses t=10 to give FreeRADIUS 10 seconds for graceful shutdown before
        SIGKILL (CP-5 mitigation: always use restart, not HUP signal).
        Returns True on success (204/200), False on failure.
        """
        container = await DockerService.get_container_by_label(docker_container_id)
        if container is None:
            logger.error(
                "restart_container: container '%s' not found via socket proxy",
                docker_container_id,
            )
            return False

        container_id = container["Id"]
        try:
            async with httpx.AsyncClient(
                base_url=settings.docker_socket_url, timeout=30.0
            ) as client:
                resp = await client.post(f"/containers/{container_id}/restart?t=10")
                if resp.status_code in (200, 204):
                    logger.info(
                        "restart_container: container '%s' (%s) restarted successfully",
                        docker_container_id,
                        container_id[:12],
                    )
                    return True
                logger.error(
                    "restart_container: unexpected status %s for container '%s'",
                    resp.status_code,
                    docker_container_id,
                )
                return False
        except httpx.HTTPError as exc:
            logger.error(
                "restart_container: HTTP error for container '%s': %s",
                docker_container_id,
                exc,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Docker restart failed: {exc}",
            )

    @staticmethod
    async def get_container_status(docker_container_id: str) -> dict:
        """Return status dict matching ServerStatus schema fields.

        Queries /containers/{id}/json and extracts State fields.
        Returns {"status": "not_found"} when no container matches.
        """
        container = await DockerService.get_container_by_label(docker_container_id)
        if container is None:
            return {"status": "not_found"}

        container_id = container["Id"]
        try:
            async with httpx.AsyncClient(
                base_url=settings.docker_socket_url, timeout=5.0
            ) as client:
                resp = await client.get(f"/containers/{container_id}/json")
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPError as exc:
            logger.error(
                "get_container_status: HTTP error for container '%s': %s",
                docker_container_id,
                exc,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Docker status unavailable: {exc}",
            )

        state = data.get("State", {})
        raw_status = state.get("Status", "unknown")
        started_at_str = state.get("StartedAt")
        finished_at_str = state.get("FinishedAt")

        uptime_seconds: int | None = None
        if raw_status == "running" and started_at_str:
            try:
                # Docker timestamps are RFC3339 with nanoseconds — truncate to microseconds
                started_dt = datetime.fromisoformat(
                    started_at_str[:26].rstrip("Z") + "+00:00"
                )
                uptime_seconds = int(
                    (datetime.now(timezone.utc) - started_dt).total_seconds()
                )
            except (ValueError, TypeError):
                uptime_seconds = None

        return {
            "status": raw_status,
            "uptime_seconds": uptime_seconds,
            "started_at": started_at_str,
            "last_restart": finished_at_str,
        }

    @staticmethod
    async def get_container_health(docker_container_id: str) -> dict:
        """Return health dict matching ServerHealth schema fields.

        Queries /containers/{id}/stats?stream=false for a single snapshot
        (PT-3 mitigation: stream=false avoids keeping a streaming connection open).
        Raises 404 if container not found.
        """
        container = await DockerService.get_container_by_label(docker_container_id)
        if container is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Container '{docker_container_id}' not found",
            )

        container_id = container["Id"]
        try:
            async with httpx.AsyncClient(
                base_url=settings.docker_socket_url, timeout=10.0
            ) as client:
                resp = await client.get(f"/containers/{container_id}/stats?stream=false")
                resp.raise_for_status()
                stats = resp.json()
        except httpx.HTTPError as exc:
            logger.error(
                "get_container_health: HTTP error for container '%s': %s",
                docker_container_id,
                exc,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Docker stats unavailable: {exc}",
            )

        # CPU calculation per Docker API spec
        cpu_stats = stats.get("cpu_stats", {})
        precpu_stats = stats.get("precpu_stats", {})
        cpu_usage = cpu_stats.get("cpu_usage", {})
        precpu_usage = precpu_stats.get("cpu_usage", {})

        cpu_delta = cpu_usage.get("total_usage", 0) - precpu_usage.get("total_usage", 0)
        system_delta = cpu_stats.get("system_cpu_usage", 0) - precpu_stats.get(
            "system_cpu_usage", 0
        )
        num_cpus = cpu_stats.get("online_cpus") or len(
            cpu_usage.get("percpu_usage") or [1]
        )

        cpu_percent = 0.0
        if system_delta > 0 and cpu_delta > 0:
            cpu_percent = (cpu_delta / system_delta) * num_cpus * 100.0

        # Memory calculation
        memory_stats = stats.get("memory_stats", {})
        # Docker reports rss usage — subtract cache when available
        mem_usage_bytes = memory_stats.get("usage", 0)
        cache_bytes = (memory_stats.get("stats") or {}).get("cache", 0)
        net_mem_bytes = max(mem_usage_bytes - cache_bytes, 0)
        mem_limit_bytes = memory_stats.get("limit", 1)

        memory_usage_mb = net_mem_bytes / (1024 * 1024)
        memory_limit_mb = mem_limit_bytes / (1024 * 1024)
        memory_percent = (
            (net_mem_bytes / mem_limit_bytes * 100.0) if mem_limit_bytes > 0 else 0.0
        )

        return {
            "cpu_percent": round(cpu_percent, 2),
            "memory_usage_mb": round(memory_usage_mb, 2),
            "memory_limit_mb": round(memory_limit_mb, 2),
            "memory_percent": round(memory_percent, 2),
        }
