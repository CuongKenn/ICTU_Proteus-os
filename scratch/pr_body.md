Fixes #483
Fixes #484

**Problem:**
1. Dynamic schema names and table names were used directly in `CREATE SCHEMA`, `SET search_path`, and `DROP TABLE` queries without parameterized identifiers or quotes, which can be vulnerable to SQL injection if tenant IDs or plugin manifests are tampered with.
2. `SET LOCAL app.current_tenant = '{context.tenant_id}'` was using an f-string instead of parameterized query, and `SET` doesn't natively support parameters.

**Solution:**
- Added regex validation `^[a-zA-Z0-9_]+$` for all dynamic schema and table names.
- Enclosed schema and table names in double quotes `"` for all SQL string interpolations.
- Replaced `SET LOCAL app.current_tenant` with `SELECT set_config('app.current_tenant_id', :tid, true)` using SQLAlchemy parameter bindings, matching the pattern in `database.py`.
