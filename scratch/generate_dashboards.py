import json
import os

def create_dashboard(uid, title, expr, filename):
    dashboard = {
        "annotations": {"list": []},
        "editable": True,
        "panels": [
            {
                "datasource": {"type": "loki", "uid": "Loki"},
                "gridPos": {"h": 20, "w": 24, "x": 0, "y": 0},
                "id": 1,
                "options": {
                    "dedupStrategy": "none",
                    "enableLogDetails": True,
                    "prettifyLogMessage": True,
                    "showCommonLabels": False,
                    "showLabels": True,
                    "showTime": True,
                    "sortOrder": "Descending",
                    "wrapLogMessage": False
                },
                "targets": [
                    {
                        "datasource": {"type": "loki", "uid": "Loki"},
                        "expr": expr,
                        "refId": "A"
                    }
                ],
                "title": title,
                "type": "logs"
            }
        ],
        "refresh": "5s",
        "schemaVersion": 36,
        "style": "dark",
        "tags": [],
        "templating": {"list": []},
        "time": {"from": "now-1h", "to": "now"},
        "timezone": "",
        "title": title,
        "uid": uid,
        "version": 1
    }
    
    path = os.path.join("deploy/grafana/dashboards", filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2)

create_dashboard(
    "plugin-install-01",
    "Plugin Install Monitoring",
    '{container="proteus-backend"} |= "cài đặt plugin"',
    "plugin_install.json"
)

create_dashboard(
    "ai-activity-01",
    "AI Command Activity",
    '{container="proteus-backend"} | json | ai_command="true"',
    "ai_activity.json"
)

create_dashboard(
    "system-errors-01",
    "System Errors",
    '{container="proteus-backend"} | json | level=~"ERROR|CRITICAL"',
    "system_errors.json"
)

# Remove old dashboard if exists
old_path = "deploy/grafana/dashboards/proteus_logs.json"
if os.path.exists(old_path):
    os.remove(old_path)

print("Dashboards created successfully!")
