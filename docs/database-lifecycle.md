# Database access and service lifecycle

## Deployment gates (not exercised locally)

Rails/bot owns writes, schema and migrations. This API uses the existing database,
not an ORM, a replica or a new production database. Same host/separate containers
is confirmed; actual network attachment, DNS, reverse proxy HTTPS and PostgreSQL
TLS/CA policy still require administrator approval. No SQL here has been run on
an existing/production database. Private Docker networking is not itself TLS proof.

Production and the default (unset `NODE_ENV`) load `.env` from the working
directory. `NODE_ENV=local` loads only `.env.local`; `NODE_ENV=test` ignores all
env files. Injected process variables take precedence, including blank values
(which still fail required-setting validation). `.env.production` is not loaded.
Tests use owned temporary directories and synthetic configuration only; they do
not read real env files or require a private `.local` directory.
Never print environment values or put passwords in CLI
arguments, reports, source control or GraphQL payloads. Startup failures emit a
generic diagnostic, not the driver/configuration exception.

Required nonblank strings: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
`DB_PORT` is required decimal integer 1..65535 (no ambient `PG*` defaults).
The ambient `PG*` namespace is rejected rather than merged, including PGOPTIONS
and PGSSLNEGOTIATION; use only the explicit DB settings. A global TLS verification
bypass is rejected as well.
Trust-auth fixtures still supply a nonempty synthetic password; no production
empty-password bypass exists.

`DB_TLS_MODE` is required, exactly one of:

- `verify`: certificate/hostname verification (`rejectUnauthorized: true`) using
  system trust, or `DB_TLS_CA` containing PEM CA certificates supplied by the
  operator. Malformed/unusable PEM fails configuration with only the key name.
  Check certificate chain, validity, server DNS name and approved trust source.
- `disabled`: explicit plaintext capability only for an administrator-approved
  private path. This is not authorization to choose it for production. Supplying
  `DB_TLS_CA` in this mode is an error, even if empty.

No opportunistic fallback, insecure certificate mode or TLS environment bypass
is supported. The tests construct system/custom CA options, not a TLS handshake.

All limits are positive decimal integers; blanks, fractions, signs, infinity,
zero, junk and values over the upper bound fail before connecting.

| Variable                | Default | Maximum | Meaning                                            |
| ----------------------- | ------: | ------: | -------------------------------------------------- |
| DB_POOL_MAX             |      10 |      50 | Connections per API process (multiply by replicas) |
| DB_CONNECT_TIMEOUT_MS   |    1000 |   10000 | pg connection and saturated acquisition wait       |
| DB_IDLE_TIMEOUT_MS      |   10000 |   60000 | Idle connection retirement                         |
| DB_QUERY_TIMEOUT_MS     |    3000 |   30000 | Client-side query response bound                   |
| DB_STATEMENT_TIMEOUT_MS |    2000 |   30000 | Independent PostgreSQL statement cancellation      |
| SHUTDOWN_TIMEOUT_MS     |    5000 |   30000 | Signal teardown deadline; exit 1 if exceeded       |
| PORT                    |    4000 |   65535 | HTTP port                                          |

`HOST` defaults to loopback `127.0.0.1`; nonblank DNS/IP listener syntax is
validated, OS bind errors fail safely. Containers require an explicit approved
binding (often `0.0.0.0`) and proxy policy. Timeout budgets are not retries: a
probe can spend up to connect/acquire plus client query time. Prefer server
statement timeout below client timeout, but both are always nonzero even when
configured in the opposite order. Client timeout alone is not server cancellation;
tests verify eventual server cancellation and subsequent successful queries.

## Health and shutdown

- `GET /health/live`: 200, `{"status":"ok"}`, independent of database state.
- `GET /health/ready`: 200, `{"status":"ok"}` after bounded `SELECT 1`, or
  503, `{"status":"unavailable"}` on saturation, outage or shutdown.
- GraphQL `healthCheck: String!` remains; now returns only `ok` or `unavailable`.
  Database time, SQL, topology, credential and driver detail are not returned.

Readiness is not a cached startup assertion and liveness is not DB readiness.
SIGTERM/SIGINT stop database admission/readiness before Nest closes the listener
and pool. Pool teardown is idempotent. Nest re-emits the handled signal after
cleanup (a child process reports signal termination, not numeric exit 0).
The process deadline bounds cleanup; configure an orchestrator grace period
longer than it. Forced deadline termination can interrupt in-flight work and is
not proof of clean completion. SIGKILL/host/Docker failure is not covered.
Startup and partially initialized listener failures use sanitized diagnostics and
attempt resource cleanup with a bounded failure path. `npm run build` precedes
`npm run start:prod` (`dist/main.js`).

## Least-privilege operator procedure

1. Audit the real database with its owner/DBA. Record every schema search path,
   relation owner, role membership (including SET ROLE reachability), PUBLIC ACL,
   extension, writable view, executable function and SECURITY DEFINER routine.
   A new NOINHERIT role is not safe if it is later granted an elevated membership.
2. Resolve shared privilege impacts before provisioning. PostgreSQL may grant
   PUBLIC TEMP/CONNECT, schema CREATE/USAGE or function EXECUTE. A role-specific
   REVOKE cannot subtract privileges granted through PUBLIC. Do not run blanket
   PUBLIC revocations in production without impact review of Rails, bots,
   extensions, jobs and other clients. Alternatives such as moving exposed
   routines to a restricted schema require the schema owner's approved change.
   Denying TEMP/CREATE and write-capable executable functions is a release gate,
   not an optional warning. Read-only transaction default is only defense in depth.
3. Review/edit `provision-api-reader.sql` with the real database/schema/role
   parameters and only the five queried physical tables. Check that none is an
   unexpected writable view, foreign object or elevated owner path. Execute only
   under explicit production approval. It creates a NEW role with NULL password;
   then provision/rotate its password through the approved operator channel
   (interactive `\password`, not a committed literal). Use secure authentication.
4. Connect as that actual login, verify the catalog and exercise healthy API reads
   first, then controlled negative capabilities in an approved nonproduction
   fixture. Do not try destructive denial tests on production tables. Set
   `default_transaction_read_only=off` in the fixture to prove ACL enforcement.
5. For later Rails schema changes, owner reviews query changes and grants SELECT
   only on newly approved named relations in the approved admin schema. Re-audit
   views/functions/ownership/sequence privileges after migrations or extensions.
   Never add broad `ALTER DEFAULT PRIVILEGES ... GRANT ... ON TABLES` here.

Run these audit queries under the actual API login (and separately use an
administrator to inspect all owners/ACLs and recursively reachable role grants):

```sql
SELECT current_user, session_user, current_database();
SHOW search_path;
SHOW default_transaction_read_only;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication,
       rolbypassrls, rolinherit FROM pg_roles WHERE rolname = current_user;
SELECT * FROM pg_auth_members; -- audit recursive membership and SET ROLE, not just inheritance
SELECT datname, datacl, has_database_privilege(datname,'CONNECT') AS connect,
       has_database_privilege(datname,'CREATE') AS create_db,
       has_database_privilege(datname,'TEMP') AS temp FROM pg_database;
SELECT nspname, nspowner::regrole, nspacl,
       has_schema_privilege(oid,'CREATE') AS create_schema,
       has_schema_privilege(oid,'USAGE') AS usage FROM pg_namespace;
SELECT n.nspname, c.relname, c.relkind, c.relowner::regrole, c.relacl,
       has_table_privilege(c.oid,'SELECT') AS can_select,
       has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS elevated
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p','v','m','f');
SELECT n.nspname,c.relname,c.relacl,
       has_sequence_privilege(c.oid,'USAGE,SELECT,UPDATE') AS any_sequence_right
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S';
SELECT n.nspname,p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.proacl,
       has_function_privilege(p.oid,'EXECUTE') AS executable
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace;
SELECT schemaname,viewname,viewowner,definition FROM pg_views;
```

Evaluate _all_ executable functions, especially SECURITY DEFINER and extension
routines: names/ACLs alone do not prove absence of side effects. Consider search
path attacks, SET ROLE, owner/RLS bypass and writable views. Built-in PUBLIC
functions remain callable in our synthetic fixture; that does not establish
arbitrary production function/extension safety. Never claim five table grants
are the entire effective privilege boundary.

Rollback/revocation (operator only): remove API traffic, disable the dedicated
login, terminate only its sessions under approved procedure, revoke its five
SELECT grants, schema USAGE and database CONNECT; remove memberships if any.
Review role dependencies and ownership, then DROP that dedicated role only after
confirming it owns nothing. Do not use broad DROP OWNED/CASCADE or change shared
PUBLIC grants as a rollback shortcut. Reconcile credentials with secret storage.
Rails data/schema and other clients must remain unchanged.

## Synthetic evidence and limitations

`test/synthetic-postgres.mjs` owns a unique `api-contract-*` disposable container,
tmpfs and ephemeral loopback port, pinned installed image, no mounted volume.
Fixture admin alone seeds/resets; app uses `api_reader` with SELECT on five tables.
Only this owned fixture revokes PUBLIC schema CREATE/database TEMP; no equivalent
production revocation has been executed. Catalog assertions show no memberships,
no elevated role flags, no CREATE/TEMP, no user functions/views; a sequence created
without grants denies nextval/setval. Real INSERT/UPDATE/DELETE/TRUNCATE and
CREATE/ALTER/DROP denials still hold after overriding the transaction default.

Real Fastify injection checks saturation, outage, liveness/readiness recovery and
safe GraphQL health strings. An isolated child executes the compiled production
entrypoint, waits for DB readiness on an ephemeral listener, receives SIGTERM,
and is checked for signal exit, closed listener and zero reader DB sessions.
The production npm script is also exercised for safe invalid-configuration
failure; EADDRINUSE exercises partially initialized cleanup. These are synthetic
local checks, not production TLS, backup, deployment or hard-kill proof.
