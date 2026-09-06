import os
path = 'core-engine/backend/app/core/use_cases/plugin_install.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("await self.session.execute(text(f'SET search_path TO \"{schema_name}\"'))", "await self.session.execute(\n                        text(f'SET search_path TO \"{schema_name}\"')\n                    )")
content = content.replace("await self.session.execute(\n                        text(f'DROP POLICY IF EXISTS tenant_isolation_policy ON \"{table}\"')\n                    )", "await self.session.execute(\n                        text(\n                            f'DROP POLICY IF EXISTS tenant_isolation_policy ON \"{table}\"'\n                        )\n                    )")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
