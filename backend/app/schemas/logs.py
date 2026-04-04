"""Pydantic schemas for log query endpoints (LOG-01 through LOG-05)."""

from datetime import datetime

from pydantic import BaseModel


class AccountingRecord(BaseModel):
    """A single radacct record with all required session fields (LOG-04)."""

    model_config = {"from_attributes": True}

    radacctid: int
    username: str
    nas_ip_address: str
    framedipaddress: str | None = None
    acct_start_time: datetime | None
    acct_stop_time: datetime | None
    acct_session_time: int | None
    acct_input_octets: int | None
    acct_output_octets: int | None
    terminate_cause: str | None


class ActiveSession(BaseModel):
    """An active radacct session (AcctStopTime IS NULL) (LOG-02)."""

    model_config = {"from_attributes": True}

    radacctid: int
    username: str
    nas_ip_address: str
    framedipaddress: str | None = None
    acct_start_time: datetime | None
    acct_stop_time: datetime | None = None
    acct_session_time: int | None
    acct_input_octets: int | None
    acct_output_octets: int | None


class PostAuthRecord(BaseModel):
    """A radpostauth record (LOG-03)."""

    model_config = {"from_attributes": True}

    id: int
    username: str
    reply: str
    authdate: datetime | None
