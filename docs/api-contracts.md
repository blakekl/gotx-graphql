# Testing the public API

Use Node 22+, installed project dependencies, Docker, and the locally installed image
`postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`.
No running API, `.env` or restored database is needed.

    npm test
    npm run lint
    npm run test:e2e
    npm run build
    ./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json

Unit tests isolate mapper behavior. The e2e command builds once, then uses Node's
built-in test runner for focused tests of the compiled AppModule, Fastify HTTP
injection, GraphQL and real PostgreSQL. Run a focused scenario after building:

    node --test --test-name-pattern='external identifiers' test/api-contract.mjs

The suite owns one uniquely named disposable database; tests run serially and
commit a TRUNCATE before each scenario so the app's separate pool sees the reset.
Plain fixture functions arrange a small public example or, only for publication
tests, a date/winner/program matrix. An explicit query inventory detects drift.
Error cases route a real PostgreSQL division-by-zero failure through the app's
query helper; this is controlled statement injection, not a network-outage test.

The lifecycle helper uses `--pull=never --rm`, tmpfs storage, test-only trust-auth
credentials and an ephemeral loopback port (never host 5432). Teardown ends the
application and fixture pools and stops only the acquired container ID. Focused
setup/assertion failure tests inspect actual pool shutdown and container absence;
HTTP injection never opens a listener. This does not guarantee cleanup after
SIGKILL or a host/Docker failure. CI additionally cleans containers carrying its
unique run label, provisions the pinned image, and uses synthetic data only.

Rails owns the canonical schema in `gotx_bot/db/schema.rb`, version
`2026_07_19_053030`. This API has no executable migrations. The single DDL block in
`test/synthetic-postgres.mjs` is a query-test subset checked against that source:
it retains queried types but omits Rails timestamps, defaults, indexes and
unqueried tables. It does not prove full schema/migration compatibility.

## External identifier contract

`screenscraperId`, `igdbId` and `winnerScreenscraperId` now use built-in GraphQL
`ID`: JSON values are exact decimal strings or null, not numbers. Database bigint
text passes through the mappers without numeric conversion, including values
above JavaScript's safe-integer range. Consumers must treat these as opaque
strings. Internal record IDs and query arguments remain GraphQL Int.

Publication and member privacy rules: [public boundary](public-dashboard-boundary.md).
A production-backup smoke check is optional, local only, and requires a genuinely
read-only DB account. It is not part of the automated suite; do not restore dumps,
read member data or provide production credentials to CI.
