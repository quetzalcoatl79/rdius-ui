"""Tests for RADIUS Pydantic schemas — operator validation (CP-2 prevention)."""

import pytest
from pydantic import ValidationError

from app.schemas.radius import (
    NasCreate,
    NasResponse,
    RadCheckCreate,
    RadGroupCheckCreate,
    RadGroupReplyCreate,
    RadReplyCreate,
    RadUserGroupCreate,
    UserCreate,
)


class TestRadCheckOperatorValidation:
    def test_check_op_colon_eq_passes(self):
        """op=':=' is valid for check attributes."""
        obj = RadCheckCreate(username="u", attribute="Framed-IP-Address", op=":=", value="10.0.0.1")
        assert obj.op == ":="

    def test_check_op_eq_eq_passes_for_non_password(self):
        """op='==' is valid for non-password check attributes."""
        obj = RadCheckCreate(username="u", attribute="NAS-Port-Type", op="==", value="Wireless-802.11")
        assert obj.op == "=="

    def test_cleartext_password_requires_colon_eq(self):
        """op='==' raises ValidationError for Cleartext-Password — CP-2 enforcement."""
        with pytest.raises(ValidationError) as exc_info:
            RadCheckCreate(username="u", attribute="Cleartext-Password", op="==", value="x")
        assert "op ':=' required" in str(exc_info.value).lower() or ":=" in str(exc_info.value)

    def test_cleartext_password_with_colon_eq_passes(self):
        """op=':=' passes for Cleartext-Password."""
        obj = RadCheckCreate(username="u", attribute="Cleartext-Password", op=":=", value="secret")
        assert obj.op == ":="

    def test_nt_password_requires_colon_eq(self):
        """Any *-Password attribute (case-insensitive) requires op=':='."""
        with pytest.raises(ValidationError):
            RadCheckCreate(username="u", attribute="NT-Password", op="==", value="hash")

    def test_user_password_requires_colon_eq(self):
        """User-Password also requires op=':='."""
        with pytest.raises(ValidationError):
            RadCheckCreate(username="u", attribute="User-Password", op="==", value="x")

    def test_invalid_check_op_rejected(self):
        """op='>' is not a valid check operator."""
        with pytest.raises(ValidationError):
            RadCheckCreate(username="u", attribute="Framed-IP-Address", op=">", value="x")

    def test_check_op_defaults_to_colon_eq(self):
        """Default op for RadCheckCreate should be ':='."""
        obj = RadCheckCreate(username="u", attribute="Framed-IP-Address", value="10.0.0.1")
        assert obj.op == ":="


class TestRadReplyOperatorValidation:
    def test_reply_op_colon_eq_passes(self):
        """op=':=' is valid for reply attributes."""
        obj = RadReplyCreate(username="u", attribute="Framed-IP-Address", op=":=", value="10.0.0.1")
        assert obj.op == ":="

    def test_reply_op_eq_rejected(self):
        """op='==' raises ValidationError in radreply context."""
        with pytest.raises(ValidationError):
            RadReplyCreate(username="u", attribute="Framed-IP-Address", op="==", value="10.0.0.1")

    def test_reply_op_plus_eq_passes(self):
        """op='+=' is valid for reply attributes."""
        obj = RadReplyCreate(username="u", attribute="Cisco-AVPair", op="+=", value="ip:addr-pool=pool1")
        assert obj.op == "+="

    def test_reply_op_assign_passes(self):
        """op='=' is valid for reply attributes."""
        obj = RadReplyCreate(username="u", attribute="Tunnel-Type", op="=", value="VLAN")
        assert obj.op == "="

    def test_invalid_reply_op_rejected(self):
        """op='!=' is not valid in radreply context."""
        with pytest.raises(ValidationError):
            RadReplyCreate(username="u", attribute="Framed-IP-Address", op="!=", value="x")


class TestNasSchemas:
    def test_nas_response_masks_secret(self):
        """NasResponse must have secret_masked='***' and no raw secret field."""
        nas = NasResponse(
            id=1,
            nasname="10.0.0.1",
            shortname="sw1",
            type="other",
            secret="verysecret123",
        )
        assert nas.secret_masked == "***"
        # raw secret must not be accessible
        assert not hasattr(nas, "secret") or getattr(nas, "secret", None) != "verysecret123"

    def test_nas_create_requires_nasname_and_secret(self):
        """NasCreate requires at minimum nasname and secret."""
        nas = NasCreate(nasname="10.0.0.2", shortname="sw2", secret="mysecret")
        assert nas.nasname == "10.0.0.2"
        assert nas.secret == "mysecret"

    def test_nas_create_defaults(self):
        """NasCreate defaults type='other'."""
        nas = NasCreate(nasname="10.0.0.3", secret="s")
        assert nas.type == "other"
        assert nas.ports is None


class TestGroupSchemas:
    def test_group_check_op_colon_eq_passes(self):
        obj = RadGroupCheckCreate(groupname="staff", attribute="Auth-Type", op=":=", value="PAP")
        assert obj.groupname == "staff"

    def test_group_check_invalid_op_rejected(self):
        """op='>' is not a valid check operator."""
        with pytest.raises(ValidationError):
            RadGroupCheckCreate(groupname="staff", attribute="Auth-Type", op=">", value="PAP")

    def test_group_reply_valid(self):
        obj = RadGroupReplyCreate(groupname="staff", attribute="Framed-Pool", op=":=", value="pool1")
        assert obj.op == ":="


class TestUserCreate:
    def test_user_create_basic(self):
        user = UserCreate(username="alice", password="pass123")
        assert user.username == "alice"
        assert user.reply_attrs == []

    def test_user_create_with_reply_attrs(self):
        user = UserCreate(
            username="alice",
            password="pass123",
            reply_attrs=[
                RadReplyCreate(username="alice", attribute="Framed-IP-Address", op=":=", value="10.0.0.5"),
            ],
        )
        assert len(user.reply_attrs) == 1


class TestRadUserGroupCreate:
    def test_rad_user_group_create(self):
        obj = RadUserGroupCreate(username="alice", groupname="staff", priority=1)
        assert obj.priority == 1

    def test_priority_defaults_to_1(self):
        obj = RadUserGroupCreate(username="alice", groupname="staff")
        assert obj.priority == 1
