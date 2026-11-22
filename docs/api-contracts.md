# Executable API contracts (GOTX-02)

## Run locally

Use Node 22+, already installed project dependencies, Docker, and the installed
PostgreSQL 16 Alpine image with repository digest
`postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`.
These commands need no restored dump, `.env`, production database, or running API:

    npm test
    npm run lint
    npm run test:e2e
    npm run build
    ./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json

Run the commands sequentially, not overlapping DB suites: both own the fixed
name `gotx-02-synthetic`. Tests use `--pull=never --rm`, tmpfs PGDATA, trust auth
with only `gotx_test`/`gotx_contract_test`, and an ephemeral 127.0.0.1 port read
with `docker port`; host 5432 is refused. No host volumes or environment fallback
for DB connections. Cleanup ends pools and stops only the container successfully
created by that invocation, including assertion/setup failures. A hard process
kill cannot execute JavaScript `finally`; CI adds an always-run owned-container
cleanup step for interrupted runs. Do not stop unrelated containers.

`test/app.e2e-spec.ts` builds with the native Nest compiler and launches
`test/api-contract.mjs`, so the real deployment decorator metadata is tested.
The runner imports the actual AppModule only after setting NODE_ENV=test, which
makes ConfigModule ignore env files, and overrides ConfigService with the owned
DB coordinates. Real Nest Fastify HTTP injection executes Apollo, resolvers,
services and PostgreSQL. The HTTP server never listens on a port. AppModule
initialization generates `src/schema.gql`; the compiler generates ignored
`dist/`. App close invokes the application DB pool shutdown; fixture pool and
container close in an outer finally. Ordinary process exit is also required.

### Abnormal-exit cleanup proof (BV-01)

Run the focused parent proof with:

    npm run test:e2e -- -t 'cleans acquired resources'

The e2e suite also runs these cases on every full invocation. Each parent launches
the real compiled runner in a synchronous child with a 45-second deadline, then
independently checks `docker ps -a` for the exact `gotx-02-synthetic` name. The
child must exit 1 normally (no signal/timeout), report its specific AssertionError
sentinel and emit the exact ordered resource-lifecycle observations. An import,
compile, connection or unrelated assertion failure is not accepted as the fault.

- `node test/api-contract.mjs assertion` throws `BV01_assertion_SENTINEL` after
  real AppModule/Fastify initialization and a real query on the application pool.
  Both fixture and application pools have acquired PostgreSQL connections. The
  assertion escapes through the existing nested cleanup; the test observes that
  `app.close()` resolved, the application pool ended, the fixture pool ended, and
  the owned container stopped. Each ended pool must have `ended === true` and
  zero total/idle clients. Fastify must not listen before the fault or after close;
  its final server address must be null.
- `node test/api-contract.mjs fixture-setup` throws
  `BV01_fixture-setup_SENTINEL` inside fixture setup after container creation and
  the fixture pool's first real query, before the helper returns. The helper's
  own catch/finally must end that acquired pool and stop its owned container.
  No Nest app or application pool exists on this path.

Lifecycle markers are emitted only after awaited operations and state assertions,
not by a catch that converts a failure to success. The parent requires the
original nonzero exit and external container absence in both cases. The ordinary
successful 29-root run and its handled `SQL_ERROR` responses remain separate
controls; neither fault mode runs those contracts or prints their success banner.
These are bounded JavaScript failure proofs, not guarantees for SIGKILL, a host
crash, Docker failure, or every possible initialization failure. No production
shutdown implementation is replaced or mocked.

CI provisions this same digest on a fresh runner, installs from the existing
lockfile and runs the four npm gates sequentially. CI is synthetic only: no DB
secrets, dumps, production network configuration or deployment steps. Local test
execution never pulls images or installs dependencies. A checked-in CI workflow
is not evidence of a remote CI run.

## Inventory and root contracts

`test/api-contract.mjs` explicitly enumerates root names, arguments, projections,
positive assertions and empty expectations. It compares exact sorted names with
the executable schema and separately asserts 29 roots, the minimal member
allowlist and no mutations. Root additions/removals/renames require deliberate
contract updates, rather than automatic discovery that silently accepts drift.

All rows below also test a real PostgreSQL division-by-zero fault routed through
the real application query helper (controlled fault injection, not a simulated
network outage). HTTP remains 200 with one GraphQL INTERNAL_SERVER_ERROR at that
root's path. Non-null roots bubble data to null; nullable game/user produce
`{root: null}`. No resolver or service is mocked. Healthy/empty paths execute the
unaltered service SQL. Invalid scalar/missing argument/private-field selections
separately return HTTP 400 validation errors without data.

| Root                             | Positive synthetic contract                                                | Empty database |
| -------------------------------- | -------------------------------------------------------------------------- | -------------- |
| avgNominationsBeforeWin          | 1                                                                          | 0              |
| avgTimeToBeatByMonth             | 3 published GOTM values of 20                                              | []             |
| completionsByUserId              | 30 public completions, false achievements                                  | []             |
| completionsCountByGame           | 30 public per-nomination counts of 1                                       | []             |
| currentWinners                   | latest future winning theme for all 5 programs, count 2, large external ID | []             |
| game                             | ID 5 metadata, both external IDs beyond 32-bit, nullable fields            | null           |
| gamesByNomination                | GOTM IDs 1, 3, 5, 9000; typed winner/loser branches                        | []             |
| gotyThemesByYear                 | 3 public dates, one theme/winner/category per date                         | []             |
| gotyThemesForYear                | public ID 305, existing per-game groups, large winner external ID          | []             |
| healthCheck                      | DB-connected prefix from actual SELECT NOW()                               | still healthy  |
| longestMonthsByAvgTimeToBeat     | 3 public GOTM duration values of 20                                        | []             |
| mostCompletedGames               | 16 games, shared game has 15 completions; typed filters                    | []             |
| mostNominatedGames               | 4 GOTM games, shared game total 3; loser-only branch                       | []             |
| mostNominatedGamesByUser         | public member total 18 under existing cross-program rules                  | []             |
| newestCompletions                | 30 public counts of 1; typed filters                                       | []             |
| nominationCountByThemeByCategory | 6 public category counts of 1                                              | []             |
| nominationData                   | 30 public joined entries                                                   | []             |
| nominationDataByGameId           | 15 shared-game public losers                                               | []             |
| nominationDataByUserId           | 30 public member entries                                                   | []             |
| nominationSuccessPercentByUser   | 12.5 points, 6 nominations/3 wins/50%; zero-public member retained         | []             |
| nominations                      | 30 rows with only public theme IDs; typed filter                           | []             |
| shortestMonthsByAvgTimeToBeat    | 3 public GOTM duration values of 20                                        | []             |
| themeDetailWithCategories        | winner and public loser, large external ID, year category                  | []             |
| themeWinners                     | only ID 5, large external ID, year category                                | []             |
| themesWithStatus                 | exact 15 published IDs, calendar dates, counts 2/1                         | []             |
| topNominationWinsByUser          | public member 3 wins                                                       | []             |
| totalNomsBeforeWinByGame         | 3 winning games, total 1 each                                              | []             |
| totalTimeToBeatByMonth           | 3 public GOTM duration values of 20                                        | []             |
| user                             | exactly id/name/earnedPoints, fractional 12.5                              | null           |

## Additional proof and boundaries

- Past/current/future crossed with winner/no-winner for each program. Future
  winners are public; even past no-winner themes are private. Direct private and
  missing theme/game relationships return empty lists, while ordinary private-
  only game metadata remains readable.
- Every non-health root is invariant after deleting unpublished/orphan fixture
  nominations and themes. Array order is canonicalized only for this invariance
  comparison because existing SQL ties do not guarantee order; positive contracts
  still assert meaningful ordering where defined (e.g. shared count leader).
- Duplicate nominations increase counts but do not duplicate the game pool.
  Null and dangling joins retain nullable relationships; untitled games use the
  fallback title, regional titles coalesce, null points remain null on User and
  zero in success stats, null durations serialize null, null achievement flags
  map to false. Missing single records return null.
- External IDs remain numeric, now GraphQL Float rather than signed 32-bit Int
  on every existing game/theme projection. Verified values are 4294967297 and 4294967298. This preserves the current JS-number mapping; it does not promise
  arbitrary bigint precision beyond Number.MAX_SAFE_INTEGER or widen internal
  record-ID arguments. No custom scalar or domain redesign is introduced.
- `test/mapper-contract.spec.ts` checks raw pg-shaped bigint strings, null/zero,
  arrays, fractional points, projection allowlisting and error propagation.
  These isolated mapper tests do not substitute for the real SQL contracts.
- `test/public-boundary.spec.ts` additionally exercises all service aggregate
  paths, latest-date/theme-ID ties and multiple winners against PostgreSQL.
- Existing GOTY detail grouping and cross-program counting are preserved as
  required by GOTX-01. Duration mode semantics are not redesigned here. These
  are regression contracts, not claims that historical domain rules were fixed.

Implementation checks are not independent code review, behavioral QA, coordinator
acceptance, remote CI, merge or deployment approval.
