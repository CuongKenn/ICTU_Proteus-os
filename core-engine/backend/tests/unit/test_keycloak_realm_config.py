# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Tests xác thực cấu hình Keycloak realm-import.json bảo mật (#688, #699)."""

import json
from pathlib import Path


def test_realm_import_security_hardening():
    # Tìm đường dẫn deploy/keycloak/realm-import.json từ vị trí file test
    backend_dir = Path(__file__).resolve().parent.parent.parent
    realm_path = backend_dir.parent.parent / "deploy" / "keycloak" / "realm-import.json"
    assert realm_path.exists(), f"Không tìm thấy {realm_path}"

    with open(realm_path, "r", encoding="utf-8") as f:
        realm = json.load(f)

    # 1. Kiểm tra không có client nào dùng wildcard redirect "*"
    for client in realm.get("clients", []):
        cid = client.get("clientId")
        redirects = client.get("redirectUris", [])
        assert (
            "*" not in redirects
        ), f"Client {cid} vẫn chứa wildcard '*' trong redirectUris: {redirects}"
        assert (
            client.get("directAccessGrantsEnabled") is False
        ), f"Client {cid} chưa tắt directAccessGrantsEnabled"

    # 2. Kiểm tra admin credentials buộc phải có temporary: true
    for user in realm.get("users", []):
        if user.get("username") == "admin":
            for cred in user.get("credentials", []):
                assert (
                    cred.get("temporary") is True
                ), "Admin credentials phải có temporary=True để ép đổi mật khẩu ở lần đăng nhập đầu tiên"


def test_keycloak_realm_proteus_bff_audience_mapper():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    realm_path = repo_root / "deploy" / "keycloak" / "realm-import.json"
    assert realm_path.exists(), "realm-import.json must exist"

    with open(realm_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    clients = data.get("clients", [])
    bff_client = next((c for c in clients if c.get("clientId") == "proteus-bff"), None)
    assert bff_client is not None, "proteus-bff client must exist in realm-import.json"

    mappers = bff_client.get("protocolMappers", [])
    aud_mapper = next(
        (m for m in mappers if m.get("protocolMapper") == "oidc-audience-mapper"), None
    )
    assert aud_mapper is not None, "proteus-bff must have an oidc-audience-mapper configured"
    assert (
        aud_mapper.get("config", {}).get("included.client.audience") == "proteus-bff"
    ), "Audience mapper must include proteus-bff audience"
