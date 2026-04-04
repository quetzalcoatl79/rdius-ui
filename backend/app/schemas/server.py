"""Pydantic schemas for server registry and Docker status/health."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ServerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    docker_container_id: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class ServerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    docker_container_id: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServerResponse(BaseModel):
    id: uuid.UUID
    name: str
    docker_container_id: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServerStatus(BaseModel):
    server_id: uuid.UUID
    container_status: str  # "running", "stopped", "restarting", "not_found"
    uptime_seconds: Optional[int] = None
    started_at: Optional[str] = None
    last_restart: Optional[str] = None


class ServerHealth(BaseModel):
    server_id: uuid.UUID
    cpu_percent: float
    memory_usage_mb: float
    memory_limit_mb: float
    memory_percent: float
