"""Tests for authentication endpoints: login, refresh, logout, /me."""

import pytest
from httpx import AsyncClient

from app.services.user_service import create_user


class TestLogin:
    async def test_login_valid_credentials_returns_access_token(
        self, client: AsyncClient, super_admin_user
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "testpassword123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # JWT has 3 parts
        assert len(data["access_token"].split(".")) == 3

    async def test_login_wrong_password_returns_401(
        self, client: AsyncClient, super_admin_user
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401

    async def test_login_unknown_email_returns_401(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@test.com", "password": "somepassword"},
        )
        assert response.status_code == 401

    async def test_login_sets_httponly_refresh_cookie(
        self, client: AsyncClient, super_admin_user
    ):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "testpassword123"},
        )
        assert response.status_code == 200
        # Check the Set-Cookie header contains HttpOnly
        set_cookie = response.headers.get("set-cookie", "")
        assert "refresh_token" in set_cookie
        assert "httponly" in set_cookie.lower()


class TestRefresh:
    async def test_refresh_with_valid_cookie_returns_new_access_token(
        self, client: AsyncClient, super_admin_user
    ):
        # First log in to get the refresh cookie
        login_response = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@test.com", "password": "testpassword123"},
        )
        assert login_response.status_code == 200

        # Extract the refresh token from the cookie header to inject manually
        set_cookie = login_response.headers.get("set-cookie", "")
        # Parse the token value from set-cookie header
        refresh_token_value = None
        for part in set_cookie.split(";"):
            part = part.strip()
            if part.startswith("refresh_token="):
                refresh_token_value = part.split("=", 1)[1]
                break

        assert refresh_token_value is not None, "refresh_token cookie not set"

        # Call /refresh with the cookie
        refresh_response = await client.post(
            "/api/v1/auth/refresh",
            cookies={"refresh_token": refresh_token_value},
        )
        assert refresh_response.status_code == 200
        data = refresh_response.json()
        assert "access_token" in data


class TestLogout:
    async def test_logout_returns_200_and_clears_cookie(
        self, client: AsyncClient, super_admin_user
    ):
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "logged out"
        # Cookie should be cleared (Max-Age=0 or deleted)
        set_cookie = response.headers.get("set-cookie", "")
        assert "refresh_token" in set_cookie
        assert "max-age=0" in set_cookie.lower() or "expires=" in set_cookie.lower()


class TestGetMe:
    async def _get_access_token(self, client: AsyncClient, email: str, password: str) -> str:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert response.status_code == 200
        return response.json()["access_token"]

    async def test_get_me_with_valid_token_returns_user_info(
        self, client: AsyncClient, super_admin_user
    ):
        token = await self._get_access_token(client, "admin@test.com", "testpassword123")
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["role"] == "super_admin"

    async def test_get_me_without_token_returns_401(self, client: AsyncClient):
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 403  # HTTPBearer returns 403 when no credentials
