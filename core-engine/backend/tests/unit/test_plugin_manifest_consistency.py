# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import json
from pathlib import Path
import yaml
import pytest


def test_hr_module_manifest_workflows_exist():
    """Verify that all workflows declared in HR manifest exist on disk."""
    repo_root = Path(__file__).resolve().parents[4]
    hr_dir = repo_root / "plugins" / "hr-module"
    manifest_path = hr_dir / "manifest.yaml"

    assert manifest_path.exists(), f"HR manifest.yaml must exist at {manifest_path}"
    with open(manifest_path, encoding="utf-8") as f:
        manifest = yaml.safe_load(f)

    workflows = manifest.get("workflows", [])
    assert len(workflows) > 0, "HR manifest must declare workflows"

    for wf in workflows:
        wf_file = wf.get("file")
        assert wf_file, f"Workflow entry missing 'file': {wf}"
        full_path = hr_dir / wf_file
        assert full_path.exists(), f"Workflow file {wf_file} does not exist on disk"
        with open(full_path, encoding="utf-8") as f:
            data = json.load(f)
            assert "name" in data or "nodes" in data


def test_hr_module_leave_balance_reset_workflow():
    """Verify leave_balance_reset.json is properly configured."""
    repo_root = Path(__file__).resolve().parents[4]
    wf_path = repo_root / "plugins" / "hr-module" / "workflows" / "leave_balance_reset.json"

    assert wf_path.exists(), "leave_balance_reset.json must exist"
    with open(wf_path, encoding="utf-8") as f:
        data = json.load(f)
    assert data.get("name") == "HR - Annual Leave Balance Reset"
    assert len(data.get("nodes", [])) > 0


def test_hr_module_payroll_config_table():
    """Verify hr_payroll_config table is declared in manifest and created in seed_data.sql."""
    repo_root = Path(__file__).resolve().parents[4]
    hr_dir = repo_root / "plugins" / "hr-module"
    manifest_path = hr_dir / "manifest.yaml"
    seed_path = hr_dir / "db" / "seed_data.sql"

    with open(manifest_path, encoding="utf-8") as f:
        manifest = yaml.safe_load(f)

    tables = manifest.get("database", {}).get("tables", [])
    assert "hr_payroll_config" in tables, "hr_payroll_config must be declared in manifest tables"
    assert "hr_payroll_records" in tables, "hr_payroll_records must be declared in manifest tables"

    with open(seed_path, encoding="utf-8") as f:
        seed_sql = f.read()
    assert "CREATE TABLE IF NOT EXISTS hr_payroll_config" in seed_sql
    assert "CREATE TABLE IF NOT EXISTS hr_payroll_records" in seed_sql
