# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
from pathlib import Path


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
