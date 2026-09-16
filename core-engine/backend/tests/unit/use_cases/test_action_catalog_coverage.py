# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Coverage bổ sung cho action_catalog (pure + mock, no DB)."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.use_cases.action_catalog import (
    CORE_ACTIONS,
    CORE_PUBLIC_READ_ACTIONS,
    CatalogAction,
    _ensure_inside_plugins_dir,
    build_catalog,
    build_catalog_for_tenant,
    infer_effect,
    render_for_prompt,
    resolve_workflow_webhook_url,
    split_plugin_action,
)


def _wf(wid, trigger="webhook", file="wf.json", **kw):
    return SimpleNamespace(id=wid, trigger=trigger, file=file, **kw)


def _manifest(name="hr-module", workflows=None, parser_dir=None):
    return SimpleNamespace(name=name, workflows=workflows or [])


class _FakeParser:
    def __init__(self, tmp, manifests):
        self.plugins_dir = tmp
        self._m = manifests

    def parse(self, code):
        if code not in self._m:
            raise ValueError(f"unknown {code}")
        m = self._m[code]
        if isinstance(m, Exception):
            raise m
        return m


# ─── _ensure_inside_plugins_dir ───────────────────────────────────────────


def test_ensure_inside_ok(tmp_path):
    out = _ensure_inside_plugins_dir(tmp_path, Path("hr-module/wf.json"))
    assert str(out).startswith(str(tmp_path.resolve()))


def test_ensure_traversal_raises(tmp_path):
    with pytest.raises(ValueError):
        _ensure_inside_plugins_dir(tmp_path, Path("../outside.json"))


def test_ensure_absolute_inside_ok(tmp_path):
    target = tmp_path / "a.json"
    target.write_text("{}")
    assert _ensure_inside_plugins_dir(tmp_path, target) == target.resolve()


def test_ensure_absolute_outside_raises(tmp_path):
    with pytest.raises(ValueError):
        _ensure_inside_plugins_dir(tmp_path, Path("/etc/passwd"))


# ─── infer_effect / constants ─────────────────────────────────────────────


@pytest.mark.parametrize(
    "action,expected",
    [
        ("hr.employees.read", "read"),
        ("HR.LEAVE.LIST", "read"),
        ("core.knowledge.search", "read"),
        ("hr.leave_requests.batch_approve", "write"),
        ("core.users.delete", "write"),
        ("balance.check", "read"),
    ],
)
def test_infer_effect(action, expected):
    assert infer_effect(action) == expected


def test_core_actions_sane():
    assert len(CORE_ACTIONS) >= 5
    assert all(isinstance(a, CatalogAction) for a in CORE_ACTIONS)
    assert CORE_PUBLIC_READ_ACTIONS <= {a.action for a in CORE_ACTIONS}


# ─── build_catalog ────────────────────────────────────────────────────────


def test_build_catalog_no_parser():
    out = build_catalog()
    assert out == CORE_ACTIONS


def test_build_catalog_parser_without_dir():
    out = build_catalog(manifest_parser=SimpleNamespace())
    assert [a.action for a in out] == [a.action for a in CORE_ACTIONS]


def test_build_catalog_dynamic(tmp_path):
    for code in ("hr-module", "broken-module", "cron-module"):
        (tmp_path / code).mkdir()
        (tmp_path / code / "manifest.yaml").write_text("x")
    parser = _FakeParser(
        tmp_path,
        {
            "hr-module": _manifest(
                "hr-module",
                [
                    _wf("leave.approve", description="duyet phep"),
                    _wf("nightly", trigger="cron", file="cron.json"),
                    SimpleNamespace(id=None, trigger="webhook", file="auto.json",
                                    description="", name="Auto"),
                ],
            ),
            "broken-module": ValueError("bad yaml"),
            "cron-module": _manifest("cron-module", [_wf("job", trigger="cron")]),
        },
    )
    out = build_catalog(manifest_parser=parser)
    actions = [a.action for a in out]
    assert "hr.leave.approve" in actions
    assert "hr.auto" in actions  # fallback stem when id None
    assert len(out) == len(CORE_ACTIONS) + 2


def test_build_catalog_no_static(tmp_path):
    (tmp_path / "hr-module").mkdir()
    (tmp_path / "hr-module" / "manifest.yaml").write_text("x")
    parser = _FakeParser(tmp_path, {"hr-module": _manifest("hr-module", [])})
    assert build_catalog(manifest_parser=parser, include_static=False) == []


def test_build_catalog_glob_error():
    # Path(plugins_dir) raises inside the try -> caught -> core actions only.
    out = build_catalog(manifest_parser=SimpleNamespace(plugins_dir=12345))
    assert [a.action for a in out] == [a.action for a in CORE_ACTIONS]


# ─── build_catalog_for_tenant ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_for_tenant_nones():
    out = await build_catalog_for_tenant(None, None, None)
    assert [a.action for a in out] == [a.action for a in CORE_ACTIONS]


@pytest.mark.asyncio
async def test_build_for_tenant_list_raises():
    repo = AsyncMock()
    repo.list_installed.side_effect = RuntimeError("db down")
    out = await build_catalog_for_tenant(repo, SimpleNamespace(), "t1")
    assert len(out) == len(CORE_ACTIONS)


@pytest.mark.asyncio
async def test_build_for_tenant_mixed():
    repo = AsyncMock()
    repo.list_installed.return_value = (
        [
            SimpleNamespace(code_name="hr-module"),
            SimpleNamespace(code_name=""),  # skipped
            SimpleNamespace(code_name="broken-module"),
            SimpleNamespace(code_name="cron-module"),
        ],
        4,
    )
    parser = _FakeParser(
        Path("/tmp"),
        {
            "hr-module": _manifest("hr-module", [_wf("leave.approve")]),
            "broken-module": ValueError("bad"),
            "cron-module": _manifest("cron-module", [_wf("j", trigger="cron")]),
        },
    )
    out = await build_catalog_for_tenant(repo, parser, "t1")
    assert "hr.leave.approve" in [a.action for a in out]
    assert len(out) == len(CORE_ACTIONS) + 1


# ─── render_for_prompt ────────────────────────────────────────────────────


def test_render_truncates():
    actions = [CatalogAction(f"a.{i}", "read", f"d{i}") for i in range(5)]
    out = render_for_prompt(actions, limit=3)
    assert "và 2 actions khác" in out
    assert render_for_prompt([]) == ""


# ─── split_plugin_action ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("hr.leave_approve", ("hr-module", "leave_approve")),
        ("core.chat-reply", ("core-module", "chat-reply")),
        ("", None),
        (None, None),
        ("a.b.c", None),
        ("onlyone", None),
        (".b", None),
        ("../x.y", None),
        ("a/b.c", None),
        ("a\\b.c", None),
        ("A upper.case", None),
    ],
)
def test_split_plugin_action(raw, expected):
    assert split_plugin_action(raw) == expected


# ─── resolve_workflow_webhook_url ─────────────────────────────────────────


def test_resolve_invalid_plugin_action():
    parser = SimpleNamespace()
    with pytest.raises(ValueError):
        resolve_workflow_webhook_url(parser, "BAD CODE!", "ok-action")
    with pytest.raises(ValueError):
        resolve_workflow_webhook_url(parser, "hr-module", "../evil")
    with pytest.raises(ValueError):
        resolve_workflow_webhook_url(parser, "hr-module", "a/b")
    with pytest.raises(ValueError):
        resolve_workflow_webhook_url(parser, "hr-module", "a\\b")
    with pytest.raises(ValueError):
        resolve_workflow_webhook_url(parser, "hr-module", "BAD ACTION!")


def test_resolve_no_matching_workflow(tmp_path):
    parser = _FakeParser(
        tmp_path, {"hr-module": _manifest("hr-module", [_wf("other")])}
    )
    with pytest.raises(ValueError, match="không thuộc plugin"):
        resolve_workflow_webhook_url(parser, "hr-module", "missing")


def test_resolve_bad_wf_file(tmp_path):
    parser = _FakeParser(
        tmp_path,
        {"hr-module": _manifest("hr-module", [_wf("evil", file="../x.json")])},
    )
    with pytest.raises(ValueError, match="không hợp lệ"):
        resolve_workflow_webhook_url(parser, "hr-module", "evil")


def test_resolve_missing_file(tmp_path):
    (tmp_path / "hr-module").mkdir()
    parser = _FakeParser(
        tmp_path, {"hr-module": _manifest("hr-module", [_wf("wf1")])}
    )
    with pytest.raises(ValueError, match="không tồn tại"):
        resolve_workflow_webhook_url(parser, "hr-module", "wf1")


def test_resolve_unreadable_json(tmp_path):
    d = tmp_path / "hr-module"
    d.mkdir()
    (d / "wf.json").write_text("not json {{{")
    parser = _FakeParser(
        tmp_path, {"hr-module": _manifest("hr-module", [_wf("wf")])}
    )
    with pytest.raises(ValueError, match="không đọc được"):
        resolve_workflow_webhook_url(parser, "hr-module", "wf")


def test_resolve_no_webhook_node(tmp_path):
    import json

    d = tmp_path / "hr-module"
    d.mkdir()
    (d / "wf.json").write_text(json.dumps({"nodes": [{"type": "other"}]}))
    parser = _FakeParser(
        tmp_path, {"hr-module": _manifest("hr-module", [_wf("wf")])}
    )
    with pytest.raises(ValueError, match="không có webhook"):
        resolve_workflow_webhook_url(parser, "hr-module", "wf")


def test_resolve_success(tmp_path, monkeypatch):
    import json

    d = tmp_path / "hr-module"
    d.mkdir()
    (d / "wf.json").write_text(
        json.dumps(
            {
                "nodes": [
                    {
                        "type": "n8n-nodes-base.webhook",
                        "parameters": {"path": "hr/leave"},
                    }
                ]
            }
        )
    )
    parser = _FakeParser(
        tmp_path, {"hr-module": _manifest("hr-module", [_wf("wf")])}
    )
    monkeypatch.setattr(
        "app.infrastructure.config.settings.N8N_URL", "http://n8n:5678/"
    )
    url = resolve_workflow_webhook_url(parser, "hr-module", "wf")
    assert url == "http://n8n:5678/webhook/hr/leave"
