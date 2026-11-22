import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { ThemesService } from '../src/themes/themes.service.js';
import { NominationsService } from '../src/nominations/nominations.service.js';
import { CompletionsService } from '../src/completions/completions.service.js';
import { GamesService } from '../src/games/games.service.js';
import { StatsService } from '../src/stats/stats.service.js';
import { UsersService } from '../src/users/users.service.js';

// No environment/production database fallback. Own exactly one disposable fixture DB.
const container = 'gotx-02-synthetic';
let owned = false;
let pool: Pool;
const programs = ['gotm', 'retro', 'rpg', 'goty', 'gotwoty'];
const publicIds = programs.flatMap((_, p) => [1, 3, 5].map((i) => p * 100 + i));
const privateIds = programs.flatMap((_, p) =>
  [2, 4, 6].map((i) => p * 100 + i),
);
let themes: ThemesService;
let nominations: NominationsService;
let completions: CompletionsService;
let games: GamesService;
let stats: StatsService;
let users: UsersService;

beforeAll(async () => {
  execFileSync(
    'docker',
    [
      'run',
      '--detach',
      '--pull=never',
      '--rm',
      '--name',
      container,
      '--tmpfs',
      '/var/lib/postgresql/data',
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '-e',
      'POSTGRES_USER=gotx_test',
      '-e',
      'POSTGRES_DB=gotx_contract_test',
      '-p',
      '127.0.0.1::5432',
      'postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea',
    ],
    { stdio: 'pipe' },
  );
  owned = true;
  const binding = execFileSync('docker', ['port', container, '5432/tcp'], {
    encoding: 'utf8',
  }).trim();
  if (!/^127\.0\.0\.1:\d+$/.test(binding))
    throw new Error('Unexpected synthetic port binding');
  const port = Number(binding.split(':')[1]);
  if (port === 5432) throw new Error('Refusing host port 5432');
  pool = new Pool({
    host: '127.0.0.1',
    port,
    user: 'gotx_test',
    database: 'gotx_contract_test',
    password: '',
    max: 1,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000,
  });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      await pool.query('SELECT 1');
      ready = true;
      break;
    } catch {
      await setTimeout(100);
    }
  }
  if (!ready) throw new Error('Synthetic Postgres not ready');
  await pool.query(`
    CREATE TABLE themes (id bigint PRIMARY KEY, title text, description text, creation_date date, nomination_type text);
    CREATE TABLE games (id bigint PRIMARY KEY, title_world text, title_usa text, title_eu text, title_jp text,
      title_other text, year text, systems text[], developer text, genres text[], img_url text,
      time_to_beat integer, screenscraper_id bigint, igdb_id bigint);
    CREATE TABLE users (id bigint PRIMARY KEY, name text, earned_points float, current_points float,
      redeemed_points float, premium_points float, discord_id bigint, admin boolean, premium_subscriber text);
    CREATE TABLE nominations (id bigint PRIMARY KEY, nomination_type text, description text,
      winner boolean, game_id bigint, user_id bigint, theme_id bigint);
    CREATE TABLE completions (id bigint PRIMARY KEY, completed_at timestamp, nomination_id bigint,
      user_id bigint, rpg_achievements boolean);
    INSERT INTO users VALUES (2, 'Public member', 12.5, 7, 5.5, 3, 123456789, true, 'private'),
      (3, 'Zero public nominations', 0, 0, 0, 0, 987654321, false, 'private');
    INSERT INTO games (id, title_world, year, time_to_beat) VALUES (9000, 'Shared game', '2000', 10);
  `);
  for (const [p, program] of programs.entries()) {
    for (let i = 1; i <= 6; i++) {
      const id = p * 100 + i;
      const winner = i % 2 === 1;
      const offset = [-100, -99, 0, 0, 100, 101][i - 1];
      await pool.query(
        `INSERT INTO themes VALUES ($1, $2, $3, CURRENT_DATE + $4::int, $5)`,
        [
          id,
          `${winner ? 'Public' : 'Unpublished'} theme ${id}`,
          `Description ${id}`,
          offset,
          program,
        ],
      );
      await pool.query(
        `INSERT INTO games (id, title_world, year, time_to_beat) VALUES ($1, $2, '1995', 20)`,
        [id, `Game ${id}`],
      );
      await pool.query(
        `INSERT INTO nominations VALUES ($1, $2, $3, $4, $5, 2, $5),
        ($6, $2, 'Shared relationship', false, 9000, 2, $5)`,
        [id * 10, program, `Nomination ${id}`, winner, id, id * 10 + 1],
      );
    }
  }
  await pool.query(`INSERT INTO nominations VALUES
    (99990, 'gotm', 'Orphan winner', true, 9000, 3, NULL),
    (99991, 'gotm', 'Missing theme', false, 9000, 3, 99999);
    INSERT INTO completions SELECT id, CURRENT_TIMESTAMP, id, 2, false FROM nominations;`);
  // Execute the actual service SQL, not pre-filtered mock rows.
  const database = {
    query: (sql: string, params?: unknown[]) => pool.query(sql, params),
  } as DatabaseService;
  themes = new ThemesService(database);
  nominations = new NominationsService(database);
  completions = new CompletionsService(database);
  games = new GamesService(database);
  stats = new StatsService(database);
  users = new UsersService(database);
}, 30000);

afterAll(async () => {
  try {
    if (pool) await pool.end();
  } finally {
    if (owned) execFileSync('docker', ['stop', container], { stdio: 'pipe' });
  }
});

describe('SQL publication boundary (synthetic Postgres)', () => {
  it('publishes only winner-selected themes across past/current/future dates', async () => {
    expect(
      (await themes.findThemesWithStatus())
        .map((r) => r.id)
        .sort((a, b) => a - b),
    ).toEqual(publicIds);
    for (const id of publicIds)
      expect(await themes.findThemeDetailWithCategories(id)).toHaveLength(2);
    for (const id of [...privateIds, 99999]) {
      expect(await themes.findThemeDetailWithCategories(id)).toEqual([]);
      expect(await themes.findThemeWinners(id)).toEqual([]);
    }
    const current = await themes.findCurrentWinners();
    expect(current.map((r) => r.themeId).sort((a, b) => a - b)).toEqual(
      programs.map((_, p) => p * 100 + 5),
    );
  });

  it('filters all nomination lists and direct game/member relationships, not game metadata', async () => {
    const all = await nominations.findAll();
    expect(all).toHaveLength(publicIds.length * 2);
    expect(all.every((r) => publicIds.includes(r.themeId!))).toBe(true);
    for (const program of programs)
      expect(await nominations.findAll(program)).toHaveLength(6);
    expect(await nominations.findNominationData()).toHaveLength(30);
    expect(await nominations.findNominationDataByUserId(2)).toHaveLength(30);
    expect(await nominations.findNominationDataByUserId(3)).toEqual([]);
    expect(await nominations.findNominationDataByGameId(9000)).toHaveLength(15);
    for (const id of privateIds) {
      expect(await nominations.findNominationDataByGameId(id)).toEqual([]);
      expect((await games.findById(id))?.id).toBe(id);
    }
    expect(await games.findById(99999)).toBeNull();
    expect(await nominations.findNominationDataByGameId(99999)).toEqual([]);
  });

  it('hides unpublished completions and randomizer pool membership', async () => {
    expect(await completions.findByUserId(2)).toHaveLength(30);
    expect(await completions.findByUserId(99999)).toEqual([]);
    for (const [p, program] of programs.entries()) {
      const expected = [p * 100 + 1, p * 100 + 3, p * 100 + 5, 9000].sort(
        (a, b) => a - b,
      );
      for (const winner of [undefined, false, true]) {
        const ids = (await games.findByNomination(program, winner))
          .map((r) => r.id)
          .sort((a, b) => a - b);
        expect(ids).toEqual(
          winner === true
            ? expected.filter((id) => id !== 9000)
            : winner === false
              ? [9000]
              : expected,
        );
      }
    }
  });

  it('never includes unpublished GOTY titles, descriptions or category counts', async () => {
    const summaries = await themes.findGotyThemesByYear();
    expect(summaries).toHaveLength(3);
    expect(
      summaries.every((r) => r.themeCount === 1 && r.totalWinners === 1),
    ).toBe(true);
    for (const row of summaries) {
      const detail = await themes.findGotyThemesForYear(row.creationDate);
      expect(detail.every((r) => publicIds.includes(r.id))).toBe(true);
    }
    expect(await themes.findGotyThemesForYear('1900-01-01')).toEqual([]);
  });

  it('all identifying aggregate paths are invariant when unpublished/orphan data is removed', async () => {
    const snapshot = async () => ({
      mostCompleted: await stats.findMostCompletedGames(),
      newest: await stats.findNewestCompletions(),
      typedCompleted: await Promise.all(
        programs.map((p) => stats.findMostCompletedGames(p)),
      ),
      typedNewest: await Promise.all(
        programs.map((p) => stats.findNewestCompletions(p)),
      ),
      beforeWin: await stats.findTotalNomsBeforeWinByGame(),
      average: await stats.findAvgNominationsBeforeWin(),
      wins: await stats.findTopNominationWinsByUser(),
      mostNominated: await stats.findMostNominatedGames(),
      losers: await stats.findMostNominatedGames(true),
      durations: await Promise.all(
        (['avg', 'total', 'longest', 'shortest'] as const).map((m) =>
          stats.findTimeToBeatByMonth(m),
        ),
      ),
      byUser: await stats.findMostNominatedGamesByUser(),
      completionCounts: await stats.findCompletionsCountByGame(),
      success: await stats.findNominationSuccessPercentByUser(),
      categories: await stats.findNominationCountByThemeByCategory(),
      goty: await themes.findGotyThemesByYear(),
    });
    const before = await snapshot();
    expect(before.average).toBe(1);
    expect(before.beforeWin).toHaveLength(3);
    expect(before.beforeWin.every((row) => row.total === 1)).toBe(true);
    expect(before.completionCounts).toHaveLength(30);
    expect(before.mostNominated).toContainEqual({
      title: 'Shared game',
      total: 3,
    });
    expect(before.wins).toEqual([{ name: 'Public member', wins: 3 }]);
    expect(before.success).toContainEqual({
      rank: 1,
      id: 2,
      name: 'Public member',
      earnedPoints: 12.5,
      successRate: 50,
      nominations: 6,
      wins: 3,
    });
    expect(before.success).toContainEqual({
      rank: 2,
      id: 3,
      name: 'Zero public nominations',
      earnedPoints: 0,
      successRate: 0,
      nominations: 0,
      wins: 0,
    });
    expect(before.categories).toHaveLength(6);
    await pool.query('BEGIN');
    try {
      await pool.query(
        'DELETE FROM nominations WHERE theme_id = ANY($1::bigint[]) OR theme_id IS NULL OR theme_id = 99999',
        [privateIds],
      );
      await pool.query('DELETE FROM themes WHERE id = ANY($1::bigint[])', [
        privateIds,
      ]);
      expect(await snapshot()).toEqual(before);
    } finally {
      await pool.query('ROLLBACK');
    }
  });

  it('projects only the documented public member fields from SQL', async () => {
    expect(await users.findById(2)).toEqual({
      id: 2,
      name: 'Public member',
      earnedPoints: 12.5,
    });
    expect(await users.findById(99999)).toBeNull();
  });

  it('preserves latest-theme ID tie breaks and returns every winner on that theme', async () => {
    await pool.query('BEGIN');
    try {
      await pool.query(`INSERT INTO themes SELECT 7, 'Tied public theme', 'Tied description', creation_date, 'gotm'
        FROM themes WHERE id = 5;
        INSERT INTO nominations VALUES (70, 'gotm', 'First tied winner', true, 1, 2, 7),
          (71, 'gotm', 'Second tied winner', true, 3, 2, 7);`);
      const current = (await themes.findCurrentWinners()).filter(
        (row) => row.nominationType === 'gotm',
      );
      expect(current).toHaveLength(2);
      expect(
        current.every((row) => row.themeId === 7 && row.nominationCount === 2),
      ).toBe(true);
      expect(current.map((row) => row.gameId).sort((a, b) => a - b)).toEqual([
        1, 3,
      ]);
    } finally {
      await pool.query('ROLLBACK');
    }
  });
});
