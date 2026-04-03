import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr

RoleEnum = Literal["super_admin", "admin", "operator", "viewer"]


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: RoleEnum = "viewer"


class UpdateUserRequest(BaseModel):
    email: EmailStr | None = None
    role: RoleEnum | None = None
    is_active: bool | None = None


class AppUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}
