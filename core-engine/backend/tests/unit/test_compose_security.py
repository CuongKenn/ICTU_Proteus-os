# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from pathlib import Path


def test_docker_compose_security_hardening():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    compose_path = repo_root / "deploy" / "docker-compose.yml"
    assert compose_path.exists(), "docker-compose.yml must exist"

    content = compose_path.read_text(encoding="utf-8")

    # 1. Grafana must not have default "admin" password fallback
    assert "GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}" not in content
    assert "GF_AUTH_ANONYMOUS_ENABLED: \"false\"" in content

    # 2. CORS ALLOWED_ORIGINS must be sourced from env variable, not hardcoded string
    assert "ALLOWED_ORIGINS: ${ALLOWED_ORIGINS" in content

    # 3. Traefik dashboard must be protected by auth middleware
    assert "traefik.http.routers.dashboard.middlewares=traefik-auth" in content
    assert "traefik.http.middlewares.traefik-auth.basicauth.users" in content


def test_traefik_production_config_hardening():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    traefik_prod = repo_root / "deploy" / "traefik" / "traefik.prod.yml"
    assert traefik_prod.exists(), "traefik.prod.yml must exist"

    content = traefik_prod.read_text(encoding="utf-8")
    assert "dashboard: false" in content, "Traefik production must disable unauthenticated public dashboard"
    assert "insecure: false" in content, "Traefik production must have insecure disabled"
