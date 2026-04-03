"""Tests for RBAC enforcement on /admin/users endpoints."""

import pytest
from httpx import AsyncClient


async def get_token(client: AsyncClient, email: str, password: str) -> str:
    """Helper: log in and return access token."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    return response.json()["access_token"]


class TestAdminUsersRBAC:
    async def test_super_admin_can_post_admin_users(
        self, client: AsyncClient, super_admin_user
    ):
        """super_admin can create users → 201."""
        token = await get_token(client, "admin@test.com", "testpassword123")
        response = await client.post(
            "/api/v1/admin/users",
            json={"email": "newuser@test.com", "password": "pass123", "role": "viewer"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 201

    async def test_admin_cannot_post_admin_users(
        self, client: AsyncClient, db_session, admin_user
    ):
        """admin role is forbidden from creating users → 403."""
        token = await get_token(client, "admin2@test.com", "testpassword123")
        response = await client.post(
            "/api/v1/admin/users",
            json={"email": "another@test.com", "password": "pass123", "role": "viewer"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_operator_cannot_post_admin_users(
        self, client: AsyncClient, db_session, operator_user
    ):
        """operator role is forbidden from creating users → 403."""
        token = await get_token(client, "operator@test.com", "testpassword123")
        response = await client.post(
            "/api/v1/admin/users",
            json={"email": "another2@test.com", "password": "pass123", "role": "viewer"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_viewer_cannot_post_admin_users(
        self, client: AsyncClient, db_session, viewer_user
    ):
        """viewer role is forbidden from creating users → 403."""
        token = await get_token(client, "viewer@test.com", "testpassword123")
        response = await client.post(
            "/api/v1/admin/users",
            json={"email": "another3@test.com", "password": "pass123", "role": "viewer"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_super_admin_can_get_admin_users(
        self, client: AsyncClient, super_admin_user
    ):
        """super_admin can list users → 200."""
        token = await get_token(client, "admin@test.com", "testpassword123")
        response = await client.get(
            "/api/v1/admin/users",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_viewer_can_access_auth_me(
        self, client: AsyncClient, db_session, viewer_user
    ):
        """viewer role can access /auth/me — available to all authenticated roles → 200."""
        token = await get_token(client, "viewer@test.com", "testpassword123")
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "viewer@test.com"
        assert data["role"] == "viewer"
