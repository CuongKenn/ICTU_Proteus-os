# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from pathlib import Path


def test_init_sql_forces_rls_and_enables_app_user_login():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    init_sql_path = repo_root / "deploy" / "postgres" / "init.sql"
    assert init_sql_path.exists(), "deploy/postgres/init.sql must exist"

    content = init_sql_path.read_text(encoding="utf-8")

    # 1. Verify app_user is configured with LOGIN
    assert "CREATE ROLE app_user WITH LOGIN" in content
    assert "GRANT USAGE ON SCHEMA public TO app_user" in content

    # 2. Verify all core tables with tenant_id have FORCE ROW LEVEL SECURITY
    core_tables = [
        "users",
        "tenant_plugins",
        "roles",
        "audit_logs",
        "ai_commands",
        "tenant_integrations",
    ]

    for table in core_tables:
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;" in content, (
            f"Missing ENABLE RLS for {table}"
        )
        assert f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;" in content, (
            f"Missing FORCE RLS for {table}"
        )


def test_plugin_install_forces_rls_on_plugin_tables():
    repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
    install_path = (
        repo_root
        / "core-engine"
        / "backend"
        / "app"
        / "core"
        / "use_cases"
        / "plugin_install.py"
    )
    assert install_path.exists(), "plugin_install.py must exist"

    content = install_path.read_text(encoding="utf-8")
    assert 'ALTER TABLE "{table}" FORCE ROW LEVEL SECURITY' in content
    assert "FOR ALL TO public" in content
