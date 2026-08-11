import json
import subprocess

out = subprocess.check_output(["gh", "pr", "list", "--json", "number,title,statusCheckRollup"])
data = json.loads(out)
for pr in data:
    num = pr["number"]
    checks = pr.get("statusCheckRollup") or []
    failures = [c["name"] for c in checks if c.get("conclusion") == "FAILURE"]
    if failures:
        print(f"PR {num} failed: {failures}")
