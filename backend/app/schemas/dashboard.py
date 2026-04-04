"""Pydantic schemas for dashboard metric endpoints (DASH-01 through DASH-05)."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class TimeRange(str, Enum):
    ONE_HOUR = "1h"
    ONE_DAY = "24h"
    SEVEN_DAYS = "7d"
    THIRTY_DAYS = "30d"


class DashboardMetrics(BaseModel):
    """Aggregated counts for the main dashboard cards (DASH-01)."""

    total_users: int
    active_sessions: int
    nas_count: int
    recent_auth_failures: int


class AuthRateBucket(BaseModel):
    """Hourly time bucket of auth success/failure counts (DASH-02)."""

    bucket: datetime
    success: int
    failure: int


class TrafficPerNas(BaseModel):
    """Total bandwidth in/out per NAS over the last 30 days (DASH-04)."""

    nas_ip: str
    shortname: str | None
    bytes_in: int
    bytes_out: int


class TopUser(BaseModel):
    """User ranked by total traffic or session time (DASH-05)."""

    username: str
    total_bytes: int
    total_session_time: int
