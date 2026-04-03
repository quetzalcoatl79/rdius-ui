"""Tests for app.core.security — JWT and password hashing functions.

All tests run in isolation — no database connection required.
"""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_token,
)


class TestPasswordHashing:
    def test_hash_password_returns_argon2_hash(self):
        """hash_password should return a string starting with $argon2."""
        result = hash_password("secret123")
        assert isinstance(result, str)
        assert result.startswith("$argon2")

    def test_verify_password_correct_password(self):
        """verify_password returns True for correct password."""
        hashed = hash_password("secret123")
        assert verify_password("secret123", hashed) is True

    def test_verify_password_wrong_password(self):
        """verify_password returns False for wrong password."""
        hashed = hash_password("secret123")
        assert verify_password("wrong", hashed) is False


class TestJWT:
    def test_create_access_token_returns_jwt_string(self):
        """create_access_token should return a JWT string with 3 dot-separated parts."""
        token = create_access_token({"sub": "user@test.com"})
        assert isinstance(token, str)
        parts = token.split(".")
        assert len(parts) == 3

    def test_verify_token_returns_payload_with_sub(self):
        """verify_token should return payload dict containing 'sub' key."""
        token = create_access_token({"sub": "user@test.com"})
        payload = verify_token(token)
        assert "sub" in payload
        assert payload["sub"] == "user@test.com"

    def test_verify_token_expired_raises_401(self):
        """verify_token should raise HTTPException 401 for expired tokens."""
        # Create a token that's already expired
        expired_payload = {
            "sub": "user@test.com",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            "type": "access",
        }
        expired_token = jwt.encode(
            expired_payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        with pytest.raises(HTTPException) as exc_info:
            verify_token(expired_token)
        assert exc_info.value.status_code == 401

    def test_verify_token_invalid_raises_401(self):
        """verify_token should raise HTTPException 401 for non-JWT strings."""
        with pytest.raises(HTTPException) as exc_info:
            verify_token("not.a.jwt")
        assert exc_info.value.status_code == 401

    def test_create_refresh_token_has_longer_expiry(self):
        """create_refresh_token should have longer expiry than access token."""
        access_token = create_access_token({"sub": "user@test.com"})
        refresh_token = create_refresh_token({"sub": "user@test.com"})

        access_payload = jwt.decode(
            access_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        refresh_payload = jwt.decode(
            refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )

        assert refresh_payload["exp"] > access_payload["exp"]
        assert refresh_payload["type"] == "refresh"
        assert access_payload["type"] == "access"
