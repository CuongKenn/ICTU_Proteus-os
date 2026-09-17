# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from jose import JWTError

from app.adapters.external.keycloak_adapter import KeycloakAdapter


@pytest.fixture
def mock_client():
    return AsyncMock(spec=httpx.AsyncClient)


@pytest.fixture
def adapter(mock_client):
    with patch("app.adapters.external.keycloak_adapter.settings") as mock_settings:
        mock_settings.keycloak_jwks_url = "http://keycloak/jwks"
        mock_settings.KEYCLOAK_CLIENT_ID = "proteus-client"
        mock_settings.KEYCLOAK_URL = "http://keycloak"
        mock_settings.KEYCLOAK_REALM = "proteus"
        mock_settings.KEYCLOAK_PUBLIC_URL = ""
        mock_settings.KEYCLOAK_ADMIN_CLIENT_ID = "admin-cli"
        mock_settings.KEYCLOAK_ADMIN_CLIENT_SECRET = "secret"
        yield KeycloakAdapter(client=mock_client)


@pytest.mark.asyncio
async def test_get_jwks_success(adapter, mock_client):
    mock_request = httpx.Request("GET", "http://test")
    mock_response = httpx.Response(
        200, json={"keys": [{"kid": "123"}]}, request=mock_request
    )
    mock_client.get.return_value = mock_response

    jwks = await adapter._get_jwks()

    assert jwks == {"keys": [{"kid": "123"}]}
    mock_client.get.assert_called_once_with("http://keycloak/jwks", timeout=10.0)


@pytest.mark.asyncio
async def test_verify_and_decode_token(adapter, mock_client):
    mock_request = httpx.Request("GET", "http://test")
    mock_client.get.return_value = httpx.Response(
        200, json={"keys": []}, request=mock_request
    )

    with patch(
        "app.adapters.external.keycloak_adapter.jwt.decode"
    ) as mock_jwt_decode, patch(
        "app.adapters.external.keycloak_adapter.jwt.get_unverified_header",
        return_value={},
    ):
        mock_jwt_decode.return_value = {"sub": "user-1", "tenant_id": "tenant-1"}

        payload = await adapter.verify_and_decode_token("fake-token")

        assert payload["sub"] == "user-1"
        mock_jwt_decode.assert_called_once_with(
            "fake-token",
            {"keys": []},
            algorithms=["RS256"],
            audience="proteus-client",
            issuer="http://keycloak/realms/proteus",
            options={"verify_exp": True, "verify_iss": True, "verify_aud": True},
        )


@pytest.mark.asyncio
async def test_verify_token_accepts_public_issuer(mock_client):
    """Production: token iss theo URL public phải được chấp nhận khi đã cấu hình."""
    with patch("app.adapters.external.keycloak_adapter.settings") as mock_settings:
        mock_settings.keycloak_jwks_url = "http://keycloak/jwks"
        mock_settings.KEYCLOAK_CLIENT_ID = "proteus-client"
        mock_settings.KEYCLOAK_URL = "http://keycloak:8080"
        mock_settings.KEYCLOAK_REALM = "proteus"
        mock_settings.KEYCLOAK_PUBLIC_URL = "https://auth.example.com"
        adapter = KeycloakAdapter(client=mock_client)

        mock_request = httpx.Request("GET", "http://test")
        mock_client.get.return_value = httpx.Response(
            200, json={"keys": []}, request=mock_request
        )

        with patch(
            "app.adapters.external.keycloak_adapter.jwt.decode"
        ) as mock_jwt_decode, patch(
            "app.adapters.external.keycloak_adapter.jwt.get_unverified_header",
            return_value={},
        ):
            mock_jwt_decode.side_effect = [
                JWTError("invalid issuer"),
                {"sub": "user-1", "tenant_id": "tenant-1"},
            ]

            payload = await adapter.verify_and_decode_token("fake-token")

            assert payload["sub"] == "user-1"
            assert mock_jwt_decode.call_count == 2
            issuers = [
                c.kwargs["issuer"] for c in mock_jwt_decode.call_args_list
            ]
            assert issuers == [
                "http://keycloak:8080/realms/proteus",
                "https://auth.example.com/realms/proteus",
            ]


@pytest.mark.asyncio
async def test_verify_token_rejects_unknown_issuer(adapter, mock_client):
    mock_request = httpx.Request("GET", "http://test")
    mock_client.get.return_value = httpx.Response(
        200, json={"keys": []}, request=mock_request
    )

    with patch(
        "app.adapters.external.keycloak_adapter.jwt.decode",
        side_effect=JWTError("invalid issuer"),
    ), patch(
        "app.adapters.external.keycloak_adapter.jwt.get_unverified_header",
        return_value={},
    ):
        with pytest.raises(JWTError):
            await adapter.verify_and_decode_token("fake-token")


@pytest.mark.asyncio
async def test_get_admin_token(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_response = httpx.Response(
        200, json={"access_token": "admin-token-123"}, request=mock_request
    )
    mock_client.post.return_value = mock_response

    token = await adapter.get_admin_token()

    assert token == "admin-token-123"
    mock_client.post.assert_called_once()


@pytest.mark.asyncio
async def test_create_role_success(adapter, mock_client):
    # Setup get_admin_token mock
    mock_request = httpx.Request("POST", "http://test")
    mock_client.post.side_effect = [
        httpx.Response(
            200, json={"access_token": "admin-token"}, request=mock_request
        ),  # for get_admin_token
        httpx.Response(201, request=mock_request),  # for create_role
    ]

    await adapter.create_role("proteus", "new_role")
    assert mock_client.post.call_count == 2


@pytest.mark.asyncio
async def test_create_role_conflict(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_client.post.side_effect = [
        httpx.Response(200, json={"access_token": "admin-token"}, request=mock_request),
        httpx.Response(409, request=mock_request),  # conflict, already exists
    ]

    await adapter.create_role("proteus", "new_role")
    # Idempotent, no error raised


@pytest.mark.asyncio
async def test_delete_role_success(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_request_del = httpx.Request("DELETE", "http://test")
    mock_client.post.return_value = httpx.Response(
        200, json={"access_token": "admin-token"}, request=mock_request
    )
    mock_client.delete.return_value = httpx.Response(204, request=mock_request_del)

    await adapter.delete_role("proteus", "old_role")
    mock_client.delete.assert_called_once()


@pytest.mark.asyncio
async def test_delete_role_not_found(adapter, mock_client):
    mock_request = httpx.Request("POST", "http://test")
    mock_request_del = httpx.Request("DELETE", "http://test")
    mock_client.post.return_value = httpx.Response(
        200, json={"access_token": "admin-token"}, request=mock_request
    )
    mock_client.delete.return_value = httpx.Response(404, request=mock_request_del)

    await adapter.delete_role("proteus", "old_role")
    mock_client.delete.assert_called_once()
