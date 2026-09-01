import re

path = "app/entrypoints/routers/plugins.py"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if "except ValueError:" in line:
        line = line.replace("except ValueError:", "except ValueError as e:")
    
    if "        )" in line and i > 0 and "raise HTTPException(" in "".join(lines[i-4:i]):
        if "from e" not in line:
            line = line.replace("        )", "        ) from e")
    
    new_lines.append(line)

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)
