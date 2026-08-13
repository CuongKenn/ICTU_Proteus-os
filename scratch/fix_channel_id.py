import os
import re

files_to_fix = [
    "core-engine/backend/app/core/use_cases/plugin_install.py",
    "core-engine/backend/app/core/use_cases/plugin_cleanup_agent.py",
    "core-engine/backend/app/core/use_cases/plugin_uninstall.py",
    "core-engine/backend/app/core/use_cases/proactive_monitor.py"
]

for filepath in files_to_fix:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Import settings if not exists
    if "from app.infrastructure.config import settings" not in content:
        content = content.replace("from app.core.domain.exceptions import", "from app.infrastructure.config import settings\nfrom app.core.domain.exceptions import")
        
        if "from app.infrastructure.config import settings" not in content: # Fallback
            content = content.replace("import logging", "import logging\nfrom app.infrastructure.config import settings")
            
    # Replace channel name formatting with settings.MATTERMOST_SYSTEM_CHANNEL_ID
    content = re.sub(
        r'await self\.mattermost_adapter\.send_message\(\s*f"plugin-alerts-\{context\.tenant_id\}",\s*msg\s*\)',
        r'await self.mattermost_adapter.send_message(settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg)',
        content
    )
    
    # Also replace any channel="general" or similar
    content = re.sub(
        r'await self\.mattermost_adapter\.send_message\(\s*channel="[^"]+",\s*text=msg\s*\)',
        r'await self.mattermost_adapter.send_message(settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg)',
        content
    )
    
    # Replace channel_name string with settings.MATTERMOST_SYSTEM_CHANNEL_ID
    content = re.sub(
        r'await self\.mattermost_adapter\.send_message\(\s*f"[^"]+",\s*msg\s*\)',
        r'await self.mattermost_adapter.send_message(settings.MATTERMOST_SYSTEM_CHANNEL_ID, msg)',
        content
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Fixed channel_id for Mattermost API")
