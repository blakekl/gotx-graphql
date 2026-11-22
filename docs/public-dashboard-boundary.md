# Public dashboard data boundary (GOTX-01)

## Publication contract

A theme is public if and only if at least one nomination with that theme ID has
`winner = true`. `creation_date` is a SQL calendar date, not a publication gate or
UTC timestamp. Past/current dates alone never publish a theme; future winning
themes are public. Rails remains the write owner; no new moderator action exists.

`src/database/publication.sql.ts` defines shared SQL relations:

- `published_themes`: winner-selected themes, with no date restriction.
- `published_nominations`: all nominations belonging to those themes, including
  non-winning runners-up. Null/missing theme relationships are not public.

Every theme/nomination-derived service query uses these relations before
aggregation, sorting and mapping, including nested winner/game filters. Response
redaction alone is not sufficient. New dashboard paths must use these relations.
Ordinary `game(id)` metadata is independent of publication; program/randomizer
pool membership and nomination/completion relationships are not.

Coverage inventory:

- Theme list/status, direct theme details/winners, GOTY date summaries/details.
- Current winners: latest published theme for each program by creation date DESC,
  then theme ID DESC, preserving all winners of that selected theme. A later
  unpublished theme cannot suppress the latest published selection.
- Nomination lists (all/typed), detail lists and game/member ID relationships.
  There is no standalone nomination-ID root in the existing API.
- Member completions and game pools (all/winners/non-winners).
- All statistics service methods: completion lists/counts, nomination counts,
  before-win totals/average, user wins/counts/success, category counts and all
  time-to-beat modes. Nested eligibility sets are filtered as well as outer rows.
  Zero-public-nomination members remain in the success table with zero counts.

Identifying aggregate policy: unpublished nominations contribute nothing to
counts, denominators, averages, category titles or program pool eligibility.
Approved earned-point balances remain public stored values, not a recomputation
from nomination records. Preserve existing cross-program counting/domain rules
within the public subset; this change does not redefine “before win” chronology
or fix unrelated historical GOTY grouping semantics.

## Member allowlist and consumer mapping

Public `User` fields are exactly `id`, `name`, `earnedPoints`. The SQL projection
also selects exactly `id, name, earned_points`. `UserNominationSuccessStat` retains
its earned-point rank and publication-filtered nomination/win statistics. There
are no GraphQL mutations. Discord IDs, admin flags, old names, timestamps,
subscription attributes and unused point balances are not public API fields.

Read-only source mapping in `gotx-randomizer/src/`:

| Source | Public mapping / decision |
| --- | --- |
| `data/Queries.ts:362-394` (`nominationSuccessPercentByUser`) | Selects `users.earned_points`, ranks by it. Map to `earnedPoints` in the GraphQL user/stat DTOs. |
| `pages/Users/Users.tsx:19-20,53-79` | Calls `dbStore.getNominationSuccessPercentByUser()`, displays “Earned Points” from `x.earned_points`, plus name/rank/nomination/win statistics. |
| `pages/Users/UserDisplay/UserDisplay.tsx:31-38,69-89,99-105` | Uses internal user ID to load relationships and name for display. Its “Earned Points” subtotal is separately calculated from completions via `nominationTypeToPoints`, with an explicit accuracy disclaimer. It is not any of the stored balance fields. Publication filtering applies to the returned completions. No new computed-points API is introduced. |
| `data/Queries.ts:37-39`, `models/game.ts` | Legacy `SELECT *` and model/conversion fields include balances/account metadata; mere transport/model presence does not establish a display requirement. |
| `current_points`, `redeemed_points`, `premium_points` | No UI display consumer found in the source caller search. Excluded as unnecessary stored balance/subscription-related data. No new meanings or product requirements inferred. |

Rails schema evidence (`gotx_bot/db/schema.rb:18-59,72-93`): theme dates are
`date`; point fields are floats; game systems/genres are arrays. This is repository
schema evidence, not verification of production storage or credentials.

## Executable proof

Run from this worktree with the already installed dependencies, Docker available,
and local `postgres:16-alpine` image (authorized image `721873c34ceb`):

    npm test -- test/public-boundary.spec.ts test/public-schema.spec.ts
    npm test
    npm run lint
    npm run build
    ./node_modules/.bin/tsc --noEmit --incremental false -p tsconfig.json

The SQL suite starts exactly one new `gotx-01-synthetic` container with
`--pull=never --rm`, tmpfs PGDATA, test-only trust-auth user/database, and an ephemeral
127.0.0.1 port obtained via `docker port`. It refuses host port 5432 and has no
production/environment connection fallback or host volumes. It uses the real
service SQL with `pg`, not mocks returning filtered rows. Cleanup ends the pool
and stops only the container successfully created by the suite, even on failure.
Do not run overlapping copies of the SQL suite (the owned name is fixed).

Fixtures cross past/current/future dates with winner/no-winner for gotm, retro,
rpg, goty and gotwoty; include public losers, mixed public/private relationships
on one game, private-only games, orphan nominations, missing IDs, zero-public-
nomination members, latest-theme tie breaks and multiple winners. Aggregate
results are compared before/after removal of unpublished/orphan fixture data in
a rolled-back transaction, with positive public-result assertions.

The schema spec runs `npm run build` and `node test/public-schema.mjs` to use the
real emitted decorator metadata. It builds all existing resolver schema types
without starting an HTTP service, importing AppModule, or loading `.env`. It
checks the executable and checked-in SDL member allowlists, rejects forbidden
field selections through GraphQL validation and asserts no mutations. Build
output is ignored `dist/`; no test configuration/dependency changes are needed.

Limitations: this is essential service/SQL and executable-schema proof, not the
broader all-root HTTP/production/Postgres infrastructure scheduled for GOTX-02.
Independent code review, dependent behavioral verification, Fenrir acceptance
and human merge/deployment approval remain separate gates. The inherited lint
error at unchanged `src/main.ts:24` is not waived or fixed by this slice.
