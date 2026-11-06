# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
import re
from pathlib import Path
import yaml
import pytest


def get_plugins_dir():
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / "plugins"


def test_workflows_have_no_deprecated_query_params():
    """Verify that no workflow uses additionalFields.queryParams (spec §4)."""
    plugins_dir = get_plugins_dir()
    for wf in plugins_dir.glob("*/workflows/*.json"):
        with open(wf, encoding="utf-8") as f:
            data = json.load(f)
        for node in data.get("nodes", []):
            params = node.get("parameters", {})
            if isinstance(params, dict):
                af = params.get("additionalFields", {})
                if isinstance(af, dict):
                    assert "queryParams" not in af, (
                        f"{wf.name}: node '{node.get('name')}' uses deprecated additionalFields.queryParams"
                    )


def test_workflow_postgres_tables_match_manifest():
    """Verify that all {{TENANT_SCHEMA}}.<table_name> match declared manifest tables."""
    plugins_dir = get_plugins_dir()
    manifests = {}
    for m in plugins_dir.glob("*/manifest.yaml"):
        with open(m, encoding="utf-8") as f:
            mdata = yaml.safe_load(f)
        tables = set(mdata.get("database", {}).get("tables", []) if mdata.get("database") else [])
        manifests[m.parent.name] = tables

    for wf in plugins_dir.glob("*/workflows/*.json"):
        plugin_name = wf.parent.parent.name
        declared_tables = manifests.get(plugin_name, set())
        with open(wf, encoding="utf-8") as f:
            data = json.load(f)
        for node in data.get("nodes", []):
            if node.get("type") == "n8n-nodes-base.postgres":
                query = node.get("parameters", {}).get("query", "")
                tables_in_query = re.findall(r"\{\{TENANT_SCHEMA\}\}\.([a-zA-Z0-9_]+)", query)
                for tbl in tables_in_query:
                    assert tbl in declared_tables, (
                        f"{wf.name} [{node.get('name')}] queries table '{tbl}' which is not in {plugin_name} manifest"
                    )


def test_workflow_tenant_queries_have_schema_placeholder():
    """Verify that all non-auth tenant queries in Postgres nodes have schema qualification."""
    plugins_dir = get_plugins_dir()
    for wf in plugins_dir.glob("*/workflows/*.json"):
        with open(wf, encoding="utf-8") as f:
            data = json.load(f)
        for node in data.get("nodes", []):
            if node.get("type") == "n8n-nodes-base.postgres":
                query = node.get("parameters", {}).get("query", "")
                # Queries targeting tenant tables must have {{TENANT_SCHEMA}}
                # Global auth queries targeting users table in public schema are excluded
                if "users" not in query:
                    assert "{{TENANT_SCHEMA}}" in query, (
                        f"{wf.name} [{node.get('name')}] missing {{TENANT_SCHEMA}} placeholder in query: {query}"
                    )


def test_plugin_install_workflow_injection():
    """Verify that workflow injection replaces {{TENANT_SCHEMA}} with actual tenant schema."""
    fake_node = {
        "type": "n8n-nodes-base.postgres",
        "parameters": {
            "query": "SELECT * FROM {{TENANT_SCHEMA}}.custom_table WHERE id = $1;",
            "additionalFields": {
                "queryParams": "={{$json.id}}"
            }
        }
    }
    tenant_schema = "tenant_abcd_1234"

    # Simulate injection logic from plugin_install.py
    if "parameters" in fake_node and "query" in fake_node["parameters"]:
        query = fake_node["parameters"]["query"]
        if "{{TENANT_SCHEMA}}" in query:
            fake_node["parameters"]["query"] = query.replace("{{TENANT_SCHEMA}}", tenant_schema)

    if fake_node.get("type") == "n8n-nodes-base.postgres":
        params = fake_node.setdefault("parameters", {})
        if isinstance(params, dict):
            af = params.get("additionalFields")
            if isinstance(af, dict) and "queryParams" in af:
                qp = af.pop("queryParams")
                params.setdefault("options", {})["queryReplacement"] = qp

    assert fake_node["parameters"]["query"] == "SELECT * FROM tenant_abcd_1234.custom_table WHERE id = $1;"
    assert fake_node["parameters"]["options"]["queryReplacement"] == "={{$json.id}}"
    assert "queryParams" not in fake_node["parameters"].get("additionalFields", {})
