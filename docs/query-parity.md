# Normalized public query parity

Compared read-only with `gotx-randomizer/src/data/Queries.ts`, `initDbClient.ts`,
`models/game.ts` and `stores/DbStore.ts`; storage contract is Rails
`gotx_bot/db/schema.rb` version `2026_07_19_053030`. This is source comparison and
synthetic execution, not inspection of production data or live schema settings.

## Export inventory

Every exported query below has a mapped API operation. P = preserved semantics
within the public subset; A = deliberate adaptation described below. All roots
have meaningful happy, empty and real statement-failure HTTP/PostgreSQL checks in
`test/api-contract.mjs`. Additional evidence names in the last column refer to
that suite's test names (substring filters work with Node's test runner).

| Queries.ts export                | GraphQL root / arguments                              | Result DTO                     | Status / focused evidence                                       |
| -------------------------------- | ----------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- |
| getRetrobits                     | gamesByNomination(nominationType:"retro")             | Game[]                         | P / publishes winner-selected                                   |
| getRpgRunnerup                   | gamesByNomination(nominationType:"rpg",winner:false)  | Game[]                         | P / publishes winner-selected                                   |
| getWinningRpg                    | gamesByNomination(nominationType:"rpg",winner:true)   | Game[]                         | P / publishes winner-selected                                   |
| getGotmRunnerup                  | gamesByNomination(nominationType:"gotm",winner:false) | Game[]                         | P / program-local runner-up                                     |
| getWinningGotm                   | gamesByNomination(nominationType:"gotm",winner:true)  | Game[]                         | P / publishes winner-selected                                   |
| getUserById                      | user(id:Int!)                                         | User or null                   | A / public read schema; fractional success                      |
| getNominations                   | nominations                                           | Nomination[]                   | P / duplicate nominations                                       |
| getGotmNominations               | nominations(nominationType:"gotm")                    | Nomination[]                   | P / publishes winner-selected                                   |
| getRetrobitNominations           | nominations(nominationType:"retro")                   | Nomination[]                   | P / publishes winner-selected                                   |
| getRpgNominations                | nominations(nominationType:"rpg")                     | Nomination[]                   | P / publishes winner-selected                                   |
| getNominationData                | nominationData                                        | NominationDetail[]             | A / missing relationships; normalized arrays                    |
| getNominationDataByGameId        | nominationDataByGameId(gameId:Int!)                   | NominationDetail[]             | A / missing relationships; regional title priority              |
| getNominationDataByUserId        | nominationDataByUserId(userId:Int!)                   | NominationDetail[]             | A / missing relationships; public responses                     |
| getCompletionsByUserId           | completionsByUserId(userId:Int!)                      | Completion[]                   | A / normalized arrays; achievement defaults                     |
| mostCompletedGames               | mostCompletedGames                                    | GameCompletionStat[]           | P / root data; private aggregates                               |
| mostCompletedGotmGames           | mostCompletedGames(nominationType:"gotm")             | GameCompletionStat[]           | P / publishes winner-selected                                   |
| mostCompletedRetrobitGames       | mostCompletedGames(nominationType:"retro")            | GameCompletionStat[]           | P / publishes winner-selected                                   |
| mostCompletedRpgGames            | mostCompletedGames(nominationType:"rpg")              | GameCompletionStat[]           | P / publishes winner-selected                                   |
| mostCompletedGotyGames           | mostCompletedGames(nominationType:"goty")             | GameCompletionStat[]           | P / publishes winner-selected                                   |
| mostCompletedRetrobitYearGames   | mostCompletedGames(nominationType:"gotwoty")          | GameCompletionStat[]           | P / publishes winner-selected                                   |
| newestCompletions                | newestCompletions                                     | GameCompletionStat[]           | P / root data; private aggregates                               |
| newestRetrobitCompletions        | newestCompletions(nominationType:"retro")             | GameCompletionStat[]           | P / publishes winner-selected                                   |
| newestGotmCompletions            | newestCompletions(nominationType:"gotm")              | GameCompletionStat[]           | P / publishes winner-selected                                   |
| newestRpgCompletions             | newestCompletions(nominationType:"rpg")               | GameCompletionStat[]           | P / publishes winner-selected                                   |
| newestGotyCompletions            | newestCompletions(nominationType:"goty")              | GameCompletionStat[]           | P / publishes winner-selected                                   |
| newestGotwotyCompletions         | newestCompletions(nominationType:"gotwoty")           | GameCompletionStat[]           | P / publishes winner-selected                                   |
| totalNomsBeforeWinByGame         | totalNomsBeforeWinByGame                              | GameNominationCountStat[]      | P / established sums                                            |
| avgNominationsBeforeWin          | avgNominationsBeforeWin                               | Float                          | A / established sums                                            |
| topNominationWinsByUser          | topNominationWinsByUser                               | UserWinStat[]                  | P / root data; private aggregates                               |
| mostNominatedGames               | mostNominatedGames                                    | GameNominationCountStat[]      | A / duplicate nominations                                       |
| mostNominatedLoserGames          | mostNominatedGames(losersOnly:true)                   | GameNominationCountStat[]      | A / duplicate nominations; public responses                     |
| avgTimeToBeatByMonth             | avgTimeToBeatByMonth                                  | ThemeTimeToBeatStat[]          | A / established sums                                            |
| totalTimeToBeatByMonth           | totalTimeToBeatByMonth                                | ThemeTimeToBeatStat[]          | A / established sums                                            |
| longestMonthsByAvgTimeToBeat     | longestMonthsByAvgTimeToBeat                          | ThemeTimeToBeatStat[]          | A / established sums                                            |
| shortestMonthsByAvgTimeToBeat    | shortestMonthsByAvgTimeToBeat                         | ThemeTimeToBeatStat[]          | A / established sums                                            |
| mostNominatedGamesByUser         | mostNominatedGamesByUser                              | UserNominationCountStat[]      | P / root data; private aggregates                               |
| completionsCountByGame           | completionsCountByGame                                | GameNominationCompletionStat[] | P / root data                                                   |
| nominationSuccessPercentByUser   | nominationSuccessPercentByUser                        | UserNominationSuccessStat[]    | A / fractional success                                          |
| nominationCountByThemeByCategory | nominationCountByThemeByCategory                      | ThemeCategoryCountStat[]       | A / historical and modern categories                            |
| getGameById                      | game(id:Int!)                                         | Game or null                   | A / external identifiers; regional title priority               |
| getThemesWithStatus              | themesWithStatus                                      | ThemeWithStatus[]              | A / publishes winner-selected                                   |
| getCurrentWinners                | currentWinners                                        | CurrentWinner[]                | A / latest-date ID tie breaks; historical and modern categories |
| getThemeDetailWithCategories     | themeDetailWithCategories(themeId:Int!)               | ThemeDetailEntry[]             | A / historical and modern categories                            |
| getGotyThemesByYear              | gotyThemesByYear                                      | GotyThemeYearSummary[]         | A / established sums                                            |
| getGotyThemesForYear             | gotyThemesForYear(creationDate:String!)               | GotyThemeDetail[]              | A / established sums; invalid internal IDs                      |
| getThemeWinners                  | themeWinners(themeId:Int!)                            | ThemeWinner[]                  | A / historical and modern categories                            |

Additive roots without FE exports: `themeYearCategories(themeId:Int!)` returns
`[ThemeYearCategory!]!`; `healthCheck` retains the existing connectivity response.
The explicit root inventory must match introspection; it is not a fixed count.

## Preserved counting and selection

- Game pools use membership, not a join producing duplicate games. Duplicate
  nominations remain separate in nomination rows and counts. `winner:false`
  excludes any game already winning in the **same program**, not merely the
  individual losing nomination. Omitted winner means all public program games.
- `mostCompletedGames` groups by game; `newestCompletions` and
  `completionsCountByGame` group by nomination, not unique game or completion day.
  Newest uses theme creation date. Secondary title ordering resolves date ties.
- “Before win” counts all existing public nominations, across programs, of games
  with a public GOTM win. It does not impose chronology. The average is across
  those game totals (zero for no eligible games). FE's malformed nested SELECT in
  `avgNominationsBeforeWin` is not copied; the established intended total average
  is exercised directly. Most-nominated counts are GOTM-only. User nomination
  counts include cross-program nominations of games nominated in GOTM; user wins
  and success rates are GOTM-only, excluding internal user IDs <=1.
- Month average uses AVG, but total/**longest/shortest all use SUM** of winning
  nominations, preserving their misleading historical names and duplicate effects.
- Latest published theme is selected per theme program by creation date DESC,
  theme ID DESC; all winning nominations on it survive. A later unpublished
  theme cannot suppress it, and a future winning theme is public.
- GOTY summary groups by exact creation date, not just year; category titles are
  a distinct string array rather than GROUP_CONCAT. Detail preserves grouping by
  theme **and winner game**, including a null-game group for nonwinners. Counts
  belong to each group, not an invented theme-wide total repeated on every row.
  Multiple themes/dates/winners are tested; no regrouping migration is included.

## Deliberate wire/storage adaptations

- [Publication/privacy](public-dashboard-boundary.md) applies before aggregates,
  including pools and nested eligibility. User is exactly id/name/earnedPoints;
  no account metadata or timestamps. Stored earned points remain public Float,
  not a recalculated completion subtotal. FE's `nominationTypeToPoints` (including
  retro 0.5 and RPG achievement bonus) remains a client display calculation.
- External `screenscraperId`, `igdbId`, `winnerScreenscraperId` are exact decimal
  GraphQL ID strings or null, never numeric conversions. Internal IDs are Int.
  Bigint extremes and null are exercised across all relevant projections.
- `title_jap` (SQLite) -> Rails `title_jp` -> `titleJp`; `system`/`genre` scalar
  fields -> Rails `systems`/`genres` arrays -> string arrays on the API. `year`
  is Rails text and GraphQL String or null, not FE's numeric assertion. Snake
  case becomes named camelCase fields; positional SQLite DTOs must not be reused.
- Regional title priority is world -> USA -> EU -> JP -> other -> `Untitled` for
  existing games, preserving SQL COALESCE semantics (empty string is not null).
  Missing game joins retain a null title, as do GOTY's nonwinner/null-game rows.
  Nomination-detail relationships retain established API LEFT JOIN behavior
  rather than dropping missing game/member rows as some FE queries do.
- `retroachievements` -> Rails `rpg_achievements` -> `rpgAchievements`, Boolean,
  with null treated as false. This is a naming adaptation, not a new points rule.
- Stat values are `total` (FE nominations), `value` (FE average/total), and
  `successRate` as a **Float percentage without FLOOR**, e.g. 100/3, zero for no
  nominations. Counts/ranks stay Int, points/averages stay Float.
- Required internal IDs must be positive 32-bit Ints. Supported program strings:
  gotm/retro/rpg/goty/gotwoty. Optional program null/omission stays unfiltered;
  empty/unknown/injection-shaped strings are errors, not empty successful lists.
  Date input is a real strict YYYY-MM-DD (years 0001..9999; leap days checked).
  Domain-invalid arguments return safe `BAD_USER_INPUT`; malformed GraphQL
  types/Int overflow are rejected by GraphQL validation/coercion. No SQL is run
  for domain-invalid arguments. Valid absent single game/user => null; lists =>
  []; empty average => 0. Transport/statement failures are not disguised as empties.

## Historical categories and metadata

`src/themes/year-categories.ts` supplies both the definitions and generated SQL
assignment for theme detail, theme winners, current winners and category counts.

| Theme ID | PRE_96         | MID               | RECENT      |
| -------- | -------------- | ----------------- | ----------- |
| <235     | pre 96: <=1995 | 96-99: 1996..1999 | 2k+: >=2000 |
| >=235    | pre 96: <=1995 | 96-01: 1996..2001 | 02+: >=2002 |

`themeYearCategories` is publication-gated like detail: missing/private => []. It
returns these three definitions then UNKNOWN / `Unknown`, even with no games in
some buckets. Each has key, label, inclusive minYear/maxYear; null bound is
unbounded. Unknown has both bounds null but means undeterminable, not all years.
Unsigned decimal year text of 1..10 digits within Int range is classified; null,
empty, nonnumeric or oversized/overflowing text is Unknown. Guarded CASE casts
cannot raise integer overflow on malformed storage. The chart now includes
`themeId` to disambiguate repeated titles. Its legacy `pre-96` label adapts to
canonical **pre 96**, and modern themes use modern ranges, not legacy 2k+.
Historical themes are not relabeled with modern cutoffs.

## Dates, callers and executable examples

Rails declares theme creation_date as DATE, completion completed_at as datetime
(precision nil). `config/application.rb` loads Rails 8 defaults and only comments
out time_zone; repository config has no active time_zone/default_timezone override.
UTC is the source-derived Rails timestamp convention, **not verified live storage
or session settings**. No new timestamp interchange is introduced. Completion
keeps its existing SQL date projection; theme/nomination dates remain YYYY-MM-DD
calendar dates. Do not make them midnight instants or copy FE DTOs' invented
13:00Z/local-date conversion. Any later actual timestamp API needs explicit UTC
offset interchange and independent storage verification first.

`initDbClient` maps SQLite arrays positionally; DbStore additionally groups current
winners by theme. Those callers need explicit GraphQL field adaptation, not a
query-text replacement. Its GOTY summary is currently a stub, and its year-number
argument/positional DTOs do not match the date-based SQL export; the API supplies
working typed date-based results without modifying that frontend here.

Executable typed consumer examples are `test/public-operations.ts`: `loadTheme`,
`categoryRows` and `loadDashboard`. They use variable-based operations, exact
string IDs and server-defined metadata order/empty buckets, with a supplied
error-checking transport and no client dependency. The project typecheck checks
these TypeScript shapes; the real HTTP suite executes both documents and asserts
returned fields. Node 22.18+ can strip their erasable types at this test seam.
Frontend adoption is separate work; these are executable examples, not a client
migration or a claim of production compatibility. See [test guide](api-contracts.md).
