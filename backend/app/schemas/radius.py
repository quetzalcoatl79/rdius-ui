"""Pydantic schemas for RADIUS entities with RADIUS operator validation.

CP-2 enforcement: Cleartext-Password (and any *-Password attribute) MUST use op=':='
in radcheck context. op='==' is forbidden in radreply context entirely.
"""

from datetime import datetime
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Operator sets per RFC 2865 / FreeRADIUS conventions
# ---------------------------------------------------------------------------

VALID_CHECK_OPS: frozenset[str] = frozenset({":=", "==", "+=", "!=", "=", ">=", "<="})
VALID_REPLY_OPS: frozenset[str] = frozenset({":=", "=", "+="})

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Generic pagination
# ---------------------------------------------------------------------------


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# RadCheck schemas
# ---------------------------------------------------------------------------


class RadCheckCreate(BaseModel):
    username: str = Field(..., max_length=64)
    attribute: str = Field(..., max_length=64)
    op: str = Field(default=":=", max_length=2)
    value: str = Field(..., max_length=253)

    @field_validator("op")
    @classmethod
    def validate_check_op(cls, v: str, info) -> str:
        if v not in VALID_CHECK_OPS:
            raise ValueError(
                f"Invalid check operator '{v}'. Must be one of: {sorted(VALID_CHECK_OPS)}"
            )
        # CP-2: *-Password attributes MUST use ':='
        attribute = info.data.get("attribute", "")
        if attribute and attribute.lower().endswith("-password") and v != ":=":
            raise ValueError(
                f"op ':=' required for *-Password attributes (got '{v}'). "
                "Using op=='==' for passwords causes FreeRADIUS to send cleartext in PAP — "
                "always use ':=' (op ':=' required for *-Password attributes)."
            )
        return v


class RadCheckOut(BaseModel):
    id: int
    username: str
    attribute: str
    op: str
    value: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# RadReply schemas
# ---------------------------------------------------------------------------


class RadReplyCreate(BaseModel):
    username: str = Field(..., max_length=64)
    attribute: str = Field(..., max_length=64)
    op: str = Field(default=":=", max_length=2)
    value: str = Field(..., max_length=253)

    @field_validator("op")
    @classmethod
    def validate_reply_op(cls, v: str) -> str:
        if v not in VALID_REPLY_OPS:
            raise ValueError(
                f"Invalid reply operator '{v}'. Must be one of: {sorted(VALID_REPLY_OPS)}"
            )
        return v


class RadReplyOut(BaseModel):
    id: int
    username: str
    attribute: str
    op: str
    value: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# RadGroupCheck schemas
# ---------------------------------------------------------------------------


class RadGroupCheckCreate(BaseModel):
    groupname: str = Field(..., max_length=64)
    attribute: str = Field(..., max_length=64)
    op: str = Field(default=":=", max_length=2)
    value: str = Field(..., max_length=253)

    @field_validator("op")
    @classmethod
    def validate_group_check_op(cls, v: str, info) -> str:
        if v not in VALID_CHECK_OPS:
            raise ValueError(
                f"Invalid check operator '{v}'. Must be one of: {sorted(VALID_CHECK_OPS)}"
            )
        attribute = info.data.get("attribute", "")
        if attribute and attribute.lower().endswith("-password") and v != ":=":
            raise ValueError(
                f"op ':=' required for *-Password attributes (got '{v}')."
            )
        return v


class RadGroupCheckOut(BaseModel):
    id: int
    groupname: str
    attribute: str
    op: str
    value: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# RadGroupReply schemas
# ---------------------------------------------------------------------------


class RadGroupReplyCreate(BaseModel):
    groupname: str = Field(..., max_length=64)
    attribute: str = Field(..., max_length=64)
    op: str = Field(default=":=", max_length=2)
    value: str = Field(..., max_length=253)

    @field_validator("op")
    @classmethod
    def validate_group_reply_op(cls, v: str) -> str:
        if v not in VALID_REPLY_OPS:
            raise ValueError(
                f"Invalid reply operator '{v}'. Must be one of: {sorted(VALID_REPLY_OPS)}"
            )
        return v


class RadGroupReplyOut(BaseModel):
    id: int
    groupname: str
    attribute: str
    op: str
    value: str

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# RadUserGroup schemas
# ---------------------------------------------------------------------------


class RadUserGroupCreate(BaseModel):
    username: str = Field(..., max_length=64)
    groupname: str = Field(..., max_length=64)
    priority: int = Field(default=1, ge=0)


class RadUserGroupOut(BaseModel):
    id: int
    username: str
    groupname: str
    priority: int

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# User-level RADIUS schemas
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    username: str = Field(..., max_length=64)
    password: str = Field(..., min_length=1)
    reply_attrs: list[RadReplyCreate] = Field(default_factory=list)


class UserUpdate(BaseModel):
    password: Optional[str] = None
    reply_attrs: Optional[list[RadReplyCreate]] = None


class UserResponse(BaseModel):
    username: str
    check_attrs: list[RadCheckOut] = []
    reply_attrs: list[RadReplyOut] = []
    groups: list[str] = []
    disabled: bool = False

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Group-level RADIUS schemas
# ---------------------------------------------------------------------------


class GroupCreate(BaseModel):
    groupname: str = Field(..., max_length=64)
    check_attrs: list[RadGroupCheckCreate] = Field(default_factory=list)
    reply_attrs: list[RadGroupReplyCreate] = Field(default_factory=list)


class GroupUpdate(BaseModel):
    check_attrs: Optional[list[RadGroupCheckCreate]] = None
    reply_attrs: Optional[list[RadGroupReplyCreate]] = None


class GroupResponse(BaseModel):
    groupname: str
    check_attrs: list[RadGroupCheckOut] = []
    reply_attrs: list[RadGroupReplyOut] = []
    members: list[str] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# NAS schemas
# ---------------------------------------------------------------------------


class NasCreate(BaseModel):
    nasname: str
    shortname: Optional[str] = None
    type: str = "other"
    ports: Optional[int] = None
    secret: str
    server: Optional[str] = None
    community: Optional[str] = None
    description: Optional[str] = None


class NasUpdate(BaseModel):
    nasname: Optional[str] = None
    shortname: Optional[str] = None
    type: Optional[str] = None
    ports: Optional[int] = None
    secret: Optional[str] = None
    server: Optional[str] = None
    community: Optional[str] = None
    description: Optional[str] = None


class NasResponse(BaseModel):
    """NAS response with secret masked — safe to return to any authenticated caller."""

    id: int
    nasname: str
    shortname: Optional[str] = None
    type: Optional[str] = None
    ports: Optional[int] = None
    secret_masked: str = "***"
    server: Optional[str] = None
    community: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_nas(cls, nas) -> "NasResponse":
        """Build NasResponse from ORM Nas instance, always masking the secret."""
        return cls(
            id=nas.id,
            nasname=nas.nasname,
            shortname=nas.shortname,
            type=nas.type,
            ports=nas.ports,
            secret_masked="***",
            server=nas.server,
            community=nas.community,
            description=nas.description,
        )


class NasResponseWithSecret(BaseModel):
    """NAS response including the raw secret — only returned by explicit /secret endpoint for admin."""

    id: int
    nasname: str
    shortname: Optional[str] = None
    type: Optional[str] = None
    ports: Optional[int] = None
    secret: str
    server: Optional[str] = None
    community: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NasMutationResponse(BaseModel):
    """Response for NAS create/update/delete operations including restart status."""

    nas: NasResponse
    restart_triggered: bool

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Effective policy (merged user+group attrs)
# ---------------------------------------------------------------------------


class EffectivePolicyEntry(BaseModel):
    source: str  # "user" or group name
    attribute: str
    op: str
    value: str
    priority: int


class EffectivePolicyResponse(BaseModel):
    username: str
    policy: list[EffectivePolicyEntry]


# ---------------------------------------------------------------------------
# Auth history / sessions
# ---------------------------------------------------------------------------


class AuthHistoryEntry(BaseModel):
    id: int
    username: str
    reply: str
    authdate: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SessionEntry(BaseModel):
    radacctid: int
    acct_session_id: str
    username: str
    nas_ip_address: str
    acct_start_time: Optional[datetime] = None
    acct_stop_time: Optional[datetime] = None
    acct_session_time: Optional[int] = None
    acct_input_octets: Optional[int] = None
    acct_output_octets: Optional[int] = None
    terminate_cause: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
