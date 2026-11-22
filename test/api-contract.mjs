// Run emitted Nest metadata, exactly as deployment does (not Vitest's TS transform).
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { DatabaseService } from '../dist/database/database.service.js';
import {
  startSyntheticPostgres,
  seedBoundary,
  programs,
  publicIds,
  privateIds,
} from './synthetic-postgres.mjs';

// Must precede the dynamic import: importing AppModule otherwise loads local env files.
process.env.NODE_ENV = 'test';
const { AppModule } = await import('../dist/app.module.js');
const fault = process.argv[2];
assert.ok(
  fault === undefined || ['assertion', 'fixture-setup'].includes(fault),
  'Only explicit synthetic test fault modes are supported',
);
const onLifecycle = (event) => console.log(`BV01 ${event}`);
const db = await startSyntheticPostgres({
  failAfterAcquire: fault === 'fixture-setup',
  onLifecycle,
});
let app;
let module;
let applicationPool;
let fastify;
try {
  await seedBoundary(db.pool);
  await db.pool.query(
    'UPDATE games SET screenscraper_id = 4294967297, igdb_id = 4294967298 WHERE id IN (5, 305)',
  );
  const date = (
    await db.pool.query(
      "SELECT TO_CHAR(creation_date, 'YYYY-MM-DD') AS date FROM themes WHERE id=305",
    )
  ).rows[0].date;
  const values = {
    DB_HOST: db.config.host,
    DB_PORT: db.config.port,
    DB_USER: db.config.user,
    DB_NAME: db.config.database,
    DB_PASSWORD: '',
  };
  module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue({ get: (key) => values[key] })
    .compile();
  app = module.createNestApplication(new FastifyAdapter(), { logger: false });
  await app.init();
  fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  // Observe the actual pg pool, not a mocked shutdown hook or a success catch.
  const database = app.get(DatabaseService);
  await database.query('SELECT 1');
  applicationPool = database.pool;
  assert.ok(applicationPool.totalCount > 0);
  onLifecycle('app-pool-connected');
  assert.equal(app.getHttpAdapter().getType(), 'fastify');
  assert.equal(
    fastify.server.listening,
    false,
    'HTTP injection must not open a listener',
  );
  onLifecycle('app-ready-no-listener');
  if (fault === 'assertion') {
    onLifecycle('assertion-sentinel');
    assert.fail('BV01_assertion_SENTINEL');
  }
  const request = async (query) => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query },
    });
    return { status: response.statusCode, ...response.json() };
  };
  const query = async (source) => {
    const result = await request(source);
    assert.equal(result.status, 200, source);
    assert.equal(
      result.errors,
      undefined,
      `${source}: ${JSON.stringify(result.errors)}`,
    );
    return result.data;
  };
  const count = (n) => (rows) => assert.equal(rows.length, n);
  const ids = (expected) => (rows) =>
    assert.deepEqual(
      rows.map((r) => r.id).sort((a, b) => a - b),
      expected,
    );
  const counts = (length, field, value) => (rows) => {
    count(length)(rows);
    assert.ok(
      rows.every((r) => r[field] === value),
      JSON.stringify(rows),
    );
  };
  // Explicit inventory: field, arguments, response projection, positive contract, empty contract.
  // Never derive this list from the schema: new/removed roots must fail the comparison below.
  const contracts = [
    ['avgNominationsBeforeWin', '', '', (value) => assert.equal(value, 1), 0],
    ['avgTimeToBeatByMonth', '', '{ theme value }', counts(3, 'value', 20), []],
    [
      'completionsByUserId',
      '(userId: 2)',
      '{ id title date themeId nominationType rpgAchievements }',
      counts(30, 'rpgAchievements', false),
      [],
    ],
    [
      'completionsCountByGame',
      '',
      '{ title completions themeId nominationType }',
      counts(30, 'completions', 1),
      [],
    ],
    [
      'currentWinners',
      '',
      '{ themeId gameId nominationType creationDate screenscraperId nominationCount }',
      (rows) => {
        assert.deepEqual(
          rows.map((r) => r.themeId).sort((a, b) => a - b),
          programs.map((_, p) => p * 100 + 5),
        );
        assert.ok(rows.every((r) => r.nominationCount === 2));
        assert.equal(
          rows.find((r) => r.gameId === 5).screenscraperId,
          4294967297,
        );
      },
      [],
    ],
    [
      'game',
      '(id: 5)',
      '{ id title screenscraperId igdbId systems genres developer }',
      (row) =>
        assert.deepEqual(row, {
          id: 5,
          title: 'Game 5',
          screenscraperId: 4294967297,
          igdbId: 4294967298,
          systems: null,
          genres: null,
          developer: null,
        }),
      null,
    ],
    [
      'gamesByNomination',
      '(nominationType: "gotm")',
      '{ id title screenscraperId }',
      ids([1, 3, 5, 9000]),
      [],
    ],
    [
      'gotyThemesByYear',
      '',
      '{ creationDate year themeCount totalWinners categoryTitles }',
      (rows) => {
        counts(3, 'themeCount', 1)(rows);
        assert.ok(
          rows.every(
            (r) => r.totalWinners === 1 && r.categoryTitles.length === 1,
          ),
        );
      },
      [],
    ],
    [
      'gotyThemesForYear',
      `(creationDate: "${date}")`,
      '{ id creationDate title nominationCount winnerCount winnerGameId winnerScreenscraperId }',
      (rows) => {
        // Existing GOTY grouping is intentionally not redesigned in this story.
        count(2)(rows);
        assert.ok(rows.every((r) => r.id === 305));
        assert.deepEqual(rows.map((r) => r.winnerCount).sort(), [0, 1]);
        assert.equal(
          rows.find((r) => r.winnerGameId === 305).winnerScreenscraperId,
          4294967297,
        );
      },
      [],
    ],
    [
      'healthCheck',
      '',
      '',
      (value) =>
        assert.match(value, /^Database connected successfully! Server time: /),
      'healthy',
    ],
    [
      'longestMonthsByAvgTimeToBeat',
      '',
      '{ theme value }',
      counts(3, 'value', 20),
      [],
    ],
    [
      'mostCompletedGames',
      '',
      '{ title completions }',
      (rows) => {
        count(16)(rows);
        assert.deepEqual(rows[0], { title: 'Shared game', completions: 15 });
      },
      [],
    ],
    [
      'mostNominatedGames',
      '',
      '{ title total }',
      (rows) => {
        count(4)(rows);
        assert.deepEqual(rows[0], { title: 'Shared game', total: 3 });
      },
      [],
    ],
    [
      'mostNominatedGamesByUser',
      '',
      '{ name nominations }',
      (rows) =>
        assert.deepEqual(rows, [{ name: 'Public member', nominations: 18 }]),
      [],
    ],
    [
      'newestCompletions',
      '',
      '{ title completions }',
      counts(30, 'completions', 1),
      [],
    ],
    [
      'nominationCountByThemeByCategory',
      '',
      '{ title category count }',
      counts(6, 'count', 1),
      [],
    ],
    [
      'nominationData',
      '',
      '{ gameId themeTitle nominationType winner }',
      count(30),
      [],
    ],
    [
      'nominationDataByGameId',
      '(gameId: 9000)',
      '{ gameId themeTitle nominationType winner }',
      counts(15, 'winner', false),
      [],
    ],
    [
      'nominationDataByUserId',
      '(userId: 2)',
      '{ gameId themeTitle nominationType winner }',
      count(30),
      [],
    ],
    [
      'nominationSuccessPercentByUser',
      '',
      '{ id name rank earnedPoints nominations wins successRate }',
      (rows) =>
        assert.deepEqual(rows, [
          {
            id: 2,
            name: 'Public member',
            rank: 1,
            earnedPoints: 12.5,
            nominations: 6,
            wins: 3,
            successRate: 50,
          },
          {
            id: 3,
            name: 'Zero public nominations',
            rank: 2,
            earnedPoints: 0,
            nominations: 0,
            wins: 0,
            successRate: 0,
          },
        ]),
      [],
    ],
    [
      'nominations',
      '',
      '{ id themeId gameId userId nominationType winner description }',
      (rows) => {
        count(30)(rows);
        assert.ok(rows.every((r) => publicIds.includes(r.themeId)));
      },
      [],
    ],
    [
      'shortestMonthsByAvgTimeToBeat',
      '',
      '{ theme value }',
      counts(3, 'value', 20),
      [],
    ],
    [
      'themeDetailWithCategories',
      '(themeId: 5)',
      '{ id gameId gameTitle screenscraperId creationDate winner yearCategory }',
      (rows) => {
        count(2)(rows);
        assert.equal(rows[0].gameId, 5);
        assert.equal(rows[0].screenscraperId, 4294967297);
        assert.equal(rows[0].winner, true);
        assert.equal(rows[1].winner, false);
      },
      [],
    ],
    [
      'themeWinners',
      '(themeId: 5)',
      '{ gameId title screenscraperId yearCategory }',
      (rows) =>
        assert.deepEqual(rows, [
          {
            gameId: 5,
            title: 'Game 5',
            screenscraperId: 4294967297,
            yearCategory: 'pre 96',
          },
        ]),
      [],
    ],
    [
      'themesWithStatus',
      '',
      '{ id creationDate status nominationCount winnerCount }',
      (rows) => {
        ids(publicIds)(rows);
        assert.ok(
          rows.every(
            (r) =>
              r.status === 'completed' &&
              r.nominationCount === 2 &&
              r.winnerCount === 1,
          ),
        );
        assert.ok(
          rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.creationDate)),
        );
      },
      [],
    ],
    [
      'topNominationWinsByUser',
      '',
      '{ name wins }',
      (rows) => assert.deepEqual(rows, [{ name: 'Public member', wins: 3 }]),
      [],
    ],
    [
      'totalNomsBeforeWinByGame',
      '',
      '{ title total }',
      counts(3, 'total', 1),
      [],
    ],
    [
      'totalTimeToBeatByMonth',
      '',
      '{ theme value }',
      counts(3, 'value', 20),
      [],
    ],
    [
      'user',
      '(id: 2)',
      '{ id name earnedPoints }',
      (row) =>
        assert.deepEqual(row, {
          id: 2,
          name: 'Public member',
          earnedPoints: 12.5,
        }),
      null,
    ],
  ];
  const schema = app.get(GraphQLSchemaHost).schema;
  assert.deepEqual(
    Object.keys(schema.getQueryType().getFields()).sort(),
    contracts.map((c) => String(c[0])).sort(),
  );
  assert.equal(contracts.length, 29);
  assert.equal(schema.getMutationType(), undefined);
  assert.deepEqual(Object.keys(schema.getType('User').getFields()).sort(), [
    'earnedPoints',
    'id',
    'name',
  ]);
  const source = ([name, args, fields]) => `{ ${name}${args} ${fields} }`;
  const baseline = {};
  for (const contract of contracts) {
    const [name, , , check] = contract;
    const value = (await query(source(contract)))[name];
    check(value);
    baseline[name] = value;
    console.log(`HAPPY ${String(name)} PASS`);
  }
  // SQL filtering, optional arguments, direct-ID bypasses and parameterization.
  for (const [p, program] of programs.entries()) {
    for (const winner of [true, false]) {
      const rows = (
        await query(
          `{ gamesByNomination(nominationType:"${program}", winner:${winner}) { id } }`,
        )
      ).gamesByNomination;
      ids(winner ? [p * 100 + 1, p * 100 + 3, p * 100 + 5] : [9000])(rows);
    }
    count(6)(
      (await query(`{ nominations(nominationType:"${program}") { id } }`))
        .nominations,
    );
    count(4)(
      (
        await query(
          `{ mostCompletedGames(nominationType:"${program}") { title } }`,
        )
      ).mostCompletedGames,
    );
    count(6)(
      (
        await query(
          `{ newestCompletions(nominationType:"${program}") { title } }`,
        )
      ).newestCompletions,
    );
  }
  assert.deepEqual(
    (await query('{ mostNominatedGames(losersOnly:true) { title total } }'))
      .mostNominatedGames,
    [{ title: 'Shared game', total: 3 }],
  );
  for (const id of [...privateIds, 99999]) {
    const result =
      await query(`{ themeDetailWithCategories(themeId:${id}) { id } themeWinners(themeId:${id}) { gameId }
      nominationDataByGameId(gameId:${id}) { gameId } }`);
    assert.deepEqual(result, {
      themeDetailWithCategories: [],
      themeWinners: [],
      nominationDataByGameId: [],
    });
  }
  assert.deepEqual(
    await query(
      '{ game(id:99999) { id } user(id:99999) { id } nominationDataByUserId(userId:3) { gameId } completionsByUserId(userId:99999) { id } }',
    ),
    {
      game: null,
      user: null,
      nominationDataByUserId: [],
      completionsByUserId: [],
    },
  );
  assert.equal(
    (await query('{ game(id:2) { id } }')).game.id,
    2,
    'ordinary game metadata is not embargoed',
  );
  assert.deepEqual(
    (
      await query(
        '{ nominations(nominationType:"gotm\u0027 OR 1=1 --") { id } }',
      )
    ).nominations,
    [],
  );
  for (const privateField of [
    'discordId',
    'admin',
    'currentPoints',
    'redeemedPoints',
    'premiumPoints',
    'premiumSubscriber',
  ]) {
    const result = await request(`{ user(id:2) { ${privateField} } }`);
    assert.equal(result.status, 400);
    assert.equal(result.data, undefined);
    assert.equal(result.errors[0].extensions.code, 'GRAPHQL_VALIDATION_FAILED');
  }
  // Duplicates are distinct nominations, but must not duplicate the game pool.
  await db.pool.query(
    "INSERT INTO nominations VALUES (80, 'gotm', 'Duplicate', false, 9000, 2, 5)",
  );
  try {
    count(4)(
      (await query('{ gamesByNomination(nominationType:"gotm") { id } }'))
        .gamesByNomination,
    );
    count(7)(
      (await query('{ nominations(nominationType:"gotm") { id } }'))
        .nominations,
    );
    assert.deepEqual(
      (await query('{ mostNominatedGames(losersOnly:true) { title total } }'))
        .mostNominatedGames,
      [{ title: 'Shared game', total: 4 }],
    );
  } finally {
    await db.pool.query('DELETE FROM nominations WHERE id=80');
  }
  // Nulls and dangling joins use nullable fields, not fabricated related records.
  await db.pool.query(`INSERT INTO games(id) VALUES(9100);
    INSERT INTO users(id,name) VALUES(4,'Null points');
    INSERT INTO nominations VALUES (91000,'gotm',NULL,false,NULL,NULL,5), (91001,'gotm',NULL,false,91999,91999,5);`);
  try {
    assert.deepEqual(
      (
        await query(
          '{ game(id:9100) { id title systems screenscraperId igdbId } }',
        )
      ).game,
      {
        id: 9100,
        title: 'Untitled',
        systems: null,
        screenscraperId: null,
        igdbId: null,
      },
    );
    assert.deepEqual(
      (await query('{ user(id:4) { id name earnedPoints } }')).user,
      { id: 4, name: 'Null points', earnedPoints: null },
    );
    const rows = (
      await query(
        '{ nominationDataByGameId(gameId:91999) { gameId title userName gameDescription } }',
      )
    ).nominationDataByGameId;
    assert.deepEqual(rows, [
      { gameId: 91999, title: null, userName: null, gameDescription: null },
    ]);
    const nullNom = (
      await query('{ nominations { id gameId userId description } }')
    ).nominations.find((r) => r.id === 91000);
    assert.deepEqual(nullNom, {
      id: 91000,
      gameId: null,
      userId: null,
      description: null,
    });
    const nullPoints = (
      await query(
        '{ nominationSuccessPercentByUser { id earnedPoints nominations wins successRate } }',
      )
    ).nominationSuccessPercentByUser.find((r) => r.id === 4);
    assert.deepEqual(nullPoints, {
      id: 4,
      earnedPoints: 0,
      nominations: 0,
      wins: 0,
      successRate: 0,
    });
    await db.pool.query(
      "UPDATE games SET title_usa='Regional fallback' WHERE id=9100; UPDATE games SET time_to_beat=NULL WHERE id=5; UPDATE completions SET rpg_achievements=NULL WHERE id=50",
    );
    assert.equal(
      (await query('{ game(id:9100) { title } }')).game.title,
      'Regional fallback',
    );
    for (const field of [
      'avgTimeToBeatByMonth',
      'totalTimeToBeatByMonth',
      'longestMonthsByAvgTimeToBeat',
      'shortestMonthsByAvgTimeToBeat',
    ]) {
      const rows = (await query(`{ ${field} { theme value } }`))[field];
      assert.equal(
        rows.find((r) => r.theme.endsWith('Public theme 5')).value,
        null,
      );
    }
    assert.equal(
      (
        await query('{ completionsByUserId(userId:2) { id rpgAchievements } }')
      ).completionsByUserId.find((r) => r.id === 50).rpgAchievements,
      false,
    );
  } finally {
    await db.pool.query(
      'DELETE FROM nominations WHERE id IN (91000,91001); DELETE FROM users WHERE id=4; DELETE FROM games WHERE id=9100; UPDATE games SET time_to_beat=20 WHERE id=5; UPDATE completions SET rpg_achievements=false WHERE id=50',
    );
  }
  // Every root is invariant to private/orphan records, including aggregate denominators.
  await db.pool.query(
    'DELETE FROM nominations WHERE theme_id = ANY($1::bigint[]) OR theme_id IS NULL OR theme_id=99999',
    [privateIds],
  );
  await db.pool.query('DELETE FROM themes WHERE id = ANY($1::bigint[])', [
    privateIds,
  ]);
  const canonical = (value) =>
    Array.isArray(value)
      ? value
          .map(canonical)
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  for (const contract of contracts.filter((c) => c[0] !== 'healthCheck')) {
    assert.deepEqual(
      canonical((await query(source(contract)))[contract[0]]),
      canonical(baseline[contract[0]]),
      `private-data invariance: ${String(contract[0])}`,
    );
  }
  await db.pool.query('TRUNCATE completions,nominations,themes,games,users');
  for (const contract of contracts) {
    const [name, , , , empty] = contract;
    const value = (await query(source(contract)))[name];
    if (name === 'healthCheck')
      assert.match(value, /^Database connected successfully!/);
    else assert.deepEqual(value, empty, `empty: ${String(name)}`);
    console.log(`EMPTY ${String(name)} PASS`);
  }
  // Controlled database fault: run real failing SQL through the application's real pg pool.
  // No resolver/service mocks or prefiltered rows. Also covers health's database dependency.
  const originalQuery = database.query.bind(database);
  database.query = () => originalQuery('SELECT 1 / 0');
  try {
    for (const contract of contracts) {
      const [name] = contract;
      const result = await request(source(contract));
      assert.equal(result.status, 200);
      assert.equal(result.errors.length, 1);
      assert.deepEqual(result.errors[0].path, [name]);
      assert.equal(result.errors[0].extensions.code, 'INTERNAL_SERVER_ERROR');
      assert.match(result.errors[0].message, /division by zero/);
      assert.deepEqual(
        result.data,
        ['game', 'user'].includes(name) ? { [name]: null } : null,
      );
      console.log(`SQL_ERROR ${String(name)} PASS`);
    }
  } finally {
    database.query = originalQuery;
  }
  for (const invalid of [
    '{ game(id:"bad") { id } }',
    '{ user(id:2147483648) { id } }',
    '{ themeWinners { gameId } }',
  ]) {
    const result = await request(invalid);
    assert.equal(result.status, 400);
    assert.equal(result.data, undefined);
    assert.ok(result.errors.length);
  }
  console.log(
    'Fastify/Postgres contracts PASS: 29 explicit roots; happy/empty/SQL error; publication/scalars/allowlist',
  );
} finally {
  try {
    if (app) await app.close();
    else if (module) await module.close();
    if (applicationPool) {
      assert.equal(applicationPool.ended, true);
      assert.equal(applicationPool.totalCount, 0);
      assert.equal(applicationPool.idleCount, 0);
      onLifecycle('app-pool-ended');
    }
    if (app) {
      assert.equal(fastify.server.listening, false);
      assert.equal(fastify.server.address(), null);
      onLifecycle('app-closed-no-listener');
    }
  } finally {
    await db.close();
  }
}
console.log(
  'Cleanup PASS: Nest app/pool closed; owned synthetic DB stopped; no HTTP listener opened',
);
