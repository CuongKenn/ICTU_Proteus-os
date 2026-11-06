# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from pathlib import Path


def test_deploy_env_example_has_no_plaintext_passwords():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    env_example = repo_root / "deploy" / ".env.example"
    assert env_example.exists(), "deploy/.env.example must exist"

    content = env_example.read_text(encoding="utf-8")
    lines = content.splitlines()

    suspicious_defaults = [
        "GRAFANA_PASSWORD=admin",
        "POSTGRES_PASSWORD=postgres",
        "KEYCLOAK_ADMIN_PASSWORD=admin",
    ]

    for item in suspicious_defaults:
        assert item not in content, f"Found insecure default in .env.example: {item}"

    # Verify CHANGE_ME placeholders are present for critical secrets
    critical_keys = [
        "POSTGRES_PASSWORD",
        "REDIS_PASSWORD",
        "KEYCLOAK_ADMIN_PASSWORD",
        "NEXTAUTH_SECRET",
        "N8N_ENCRYPTION_KEY",
        "METABASE_SECRET_KEY",
        "GRAFANA_PASSWORD",
    ]

    for key in critical_keys:
        matching_lines = [l for l in lines if l.startswith(f"{key}=")]
        assert len(matching_lines) >= 1, f"Missing critical key {key} in .env.example"
        val = matching_lines[0].split("=", 1)[1]
        assert "CHANGE_ME" in val or val == "", (
            f"Key {key} should have a placeholder or be empty, found: {val}"
        )


def test_gitignore_ignores_env_files():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    root_gitignore = repo_root / ".gitignore"
    deploy_gitignore = repo_root / "deploy" / ".gitignore"

    assert root_gitignore.exists(), ".gitignore must exist"
    root_content = root_gitignore.read_text(encoding="utf-8")
    assert ".env" in root_content, ".gitignore must ignore .env"

    assert deploy_gitignore.exists(), "deploy/.gitignore must exist"
    deploy_content = deploy_gitignore.read_text(encoding="utf-8")
    assert ".env" in deploy_content, "deploy/.gitignore must ignore .env"
