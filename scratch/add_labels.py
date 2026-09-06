import re

with open('deploy/docker-compose.yml', 'r', encoding='utf-8') as f:
    lines = f.readlines()

services_to_label = [
    'postgres', 'redis', 'keycloak', 'qdrant', 'n8n', 'mattermost', 
    'metabase', 'appsmith', 'outline', 'backend', 'frontend', 'traefik'
]

# We need to insert `- "proteus.log=true"` under `labels:` for each of these services.
# If `labels:` doesn't exist, we create it.

new_lines = []
current_service = None
indent = ""

# Actually, it's easier to find the block for each service, and insert at the end of the block.
content = "".join(lines)

for svc in services_to_label:
    # Match service definition like `  postgres:\n`
    # and find where the next service `  something:\n` starts or end of `services` block.
    # It's easier to just do simple replacements.

    if svc == 'postgres':
        content = content.replace("      retries: 5\n", "      retries: 5\n    labels:\n      - \"proteus.log=true\"\n", 1)
    elif svc == 'redis':
        content = content.replace("      retries: 5\n\n  #", "      retries: 5\n    labels:\n      - \"proteus.log=true\"\n\n  #", 1)
    elif svc == 'qdrant':
        content = content.replace("      - proteus-net\n    # Không expose", "      - proteus-net\n    labels:\n      - \"proteus.log=true\"\n    # Không expose", 1)
    else:
        # services that already have `labels:`
        # Find `  {svc}:\n ... labels:\n` and insert right after it.
        pattern = f"  {svc}:\n(.*?    labels:\n)"
        match = re.search(pattern, content, flags=re.DOTALL)
        if match:
            replacement = match.group(0) + "      - \"proteus.log=true\"\n"
            content = content.replace(match.group(0), replacement, 1)

with open('deploy/docker-compose.yml', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated docker-compose.yml with labels")
