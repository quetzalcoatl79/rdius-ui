"""Pydantic schemas for server registry and Docker/remote status/health."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ServerType(str, Enum):
    DOCKER = "docker"
    REMOTE = "remote"


class ServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    server_type: ServerType = ServerType.DOCKER
    docker_container_id: Optional[str] = Field(default=None, max_length=100)
    remote_host: Optional[str] = Field(default=None, max_length=255)
    remote_port: int = Field(default=22, ge=1, le=65535)
    remote_user: Optional[str] = Field(default=None, max_length=100)
    remote_restart_cmd: Optional[str] = Field(default="sudo systemctl restart freeradius", max_length=500)
    remote_status_cmd: Optional[str] = Field(default="systemctl is-active freeradius", max_length=500)
    description: Optional[str] = None

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.server_type == ServerType.DOCKER:
            if not self.docker_container_id:
                raise ValueError("docker_container_id is required for Docker servers")
        elif self.server_type == ServerType.REMOTE:
            if not self.remote_host:
                raise ValueError("remote_host is required for remote servers")
            if not self.remote_user:
                raise ValueError("remote_user is required for remote servers")
        return self


class ServerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    server_type: Optional[ServerType] = None
    docker_container_id: Optional[str] = Field(default=None, max_length=100)
    remote_host: Optional[str] = Field(default=None, max_length=255)
    remote_port: Optional[int] = Field(default=None, ge=1, le=65535)
    remote_user: Optional[str] = Field(default=None, max_length=100)
    remote_restart_cmd: Optional[str] = Field(default=None, max_length=500)
    remote_status_cmd: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServerResponse(BaseModel):
    id: uuid.UUID
    name: str
    server_type: str
    docker_container_id: Optional[str]
    remote_host: Optional[str]
    remote_port: int
    remote_user: Optional[str]
    remote_restart_cmd: Optional[str]
    remote_status_cmd: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServerStatus(BaseModel):
    server_id: uuid.UUID
    container_status: str  # "running", "stopped", "restarting", "not_found", "unknown"
    uptime_seconds: Optional[int] = None
    started_at: Optional[str] = None
    last_restart: Optional[str] = None


class ServerHealth(BaseModel):
    server_id: uuid.UUID
    cpu_percent: float
    memory_usage_mb: float
    memory_limit_mb: float
    memory_percent: float
