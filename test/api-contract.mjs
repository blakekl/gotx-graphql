// Native compiler metadata is required at this seam, just as in deployment.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, beforeEach, after, describe, it } from 'node:test';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { startTestContext, remainingContainer } from './synthetic-postgres.mjs';
import {
  seedMembers,
  seedPublicExample,
  seedPublicationMatrix,
  programs,
  publicIds,
  privateIds,
} from './fixtures.mjs';

// Explicit inventory, never derived from introspection. Each entry is just a
// GraphQL selection and its observable result for the small ordinary fixture.
/** @type {Record<string, [string, unknown]>} */
const roots = {
  avgNominationsBeforeWin: ['avgNominationsBeforeWin', 1],
  avgTimeToBeatByMonth: [
    'avgTimeToBeatByMonth { theme value }',
    [{ theme: '2026-01-01 - Monthly theme', value: 20 }],
  ],
  completionsByUserId: [
    'completionsByUserId(userId:2) { id themeId rpgAchievements date }',
    [50, 51, 3050, 3051].map((id) => ({
      id,
      themeId: id < 100 ? 5 : 305,
      rpgAchievements: false,
      date: '2026-01-02',
    })),
  ],
  completionsCountByGame: [
    'completionsCountByGame { title completions themeId nominationType }',
    [
      {
        title: 'Monthly winner',
        completions: 1,
        themeId: 5,
        nominationType: 'gotm',
      },
      {
        title: 'Shared game',
        completions: 1,
        themeId: 5,
        nominationType: 'gotm',
      },
      {
        title: 'Annual winner',
        completions: 1,
        themeId: 305,
        nominationType: 'goty',
      },
      {
        title: 'Shared game',
        completions: 1,
        themeId: 305,
        nominationType: 'goty',
      },
    ],
  ],
  currentWinners: [
    'currentWinners { themeId gameId nominationCount screenscraperId }',
    [
      { themeId: 5, gameId: 5, nominationCount: 2, screenscraperId: '123' },
      { themeId: 305, gameId: 305, nominationCount: 2, screenscraperId: '789' },
    ],
  ],
  game: [
    'game(id:5) { id title screenscraperId igdbId systems genres developer }',
    {
      id: 5,
      title: 'Monthly winner',
      screenscraperId: '123',
      igdbId: '456',
      systems: null,
      genres: null,
      developer: null,
    },
  ],
  gamesByNomination: [
    'gamesByNomination(nominationType:"gotm") { id }',
    [{ id: 5 }, { id: 9000 }],
  ],
  gotyThemesByYear: [
    'gotyThemesByYear { creationDate year themeCount totalWinners categoryTitles }',
    [
      {
        creationDate: '2026-01-01',
        year: 2026,
        themeCount: 1,
        totalWinners: 1,
        categoryTitles: ['Annual theme'],
      },
    ],
  ],
  gotyThemesForYear: [
    'gotyThemesForYear(creationDate:"2026-01-01") { id nominationCount winnerCount winnerGameId winnerScreenscraperId }',
    [
      {
        id: 305,
        nominationCount: 1,
        winnerCount: 1,
        winnerGameId: 305,
        winnerScreenscraperId: '789',
      },
      {
        id: 305,
        nominationCount: 1,
        winnerCount: 0,
        winnerGameId: null,
        winnerScreenscraperId: null,
      },
    ],
  ],
  healthCheck: [
    'healthCheck',
    /^Database connected successfully! Server time: /,
  ],
  longestMonthsByAvgTimeToBeat: [
    'longestMonthsByAvgTimeToBeat { theme value }',
    [{ theme: '2026-01-01 - Monthly theme', value: 20 }],
  ],
  mostCompletedGames: [
    'mostCompletedGames { title completions }',
    [
      { title: 'Shared game', completions: 2 },
      { title: 'Monthly winner', completions: 1 },
      { title: 'Annual winner', completions: 1 },
    ],
  ],
  mostNominatedGames: [
    'mostNominatedGames { title total }',
    [
      { title: 'Monthly winner', total: 1 },
      { title: 'Shared game', total: 1 },
    ],
  ],
  mostNominatedGamesByUser: [
    'mostNominatedGamesByUser { name nominations }',
    [{ name: 'Public member', nominations: 3 }],
  ],
  newestCompletions: [
    'newestCompletions { title completions }',
    [
      { title: 'Monthly winner', completions: 1 },
      { title: 'Shared game', completions: 1 },
      { title: 'Annual winner', completions: 1 },
      { title: 'Shared game', completions: 1 },
    ],
  ],
  nominationCountByThemeByCategory: [
    'nominationCountByThemeByCategory { title category count }',
    [
      { title: 'Monthly theme', category: 'pre-96', count: 1 },
      { title: 'Monthly theme', category: '2k+', count: 1 },
    ],
  ],
  nominationData: [
    'nominationData { gameId themeTitle winner }',
    [
      { gameId: 5, themeTitle: 'Monthly theme', winner: true },
      { gameId: 9000, themeTitle: 'Monthly theme', winner: false },
      { gameId: 305, themeTitle: 'Annual theme', winner: true },
      { gameId: 9000, themeTitle: 'Annual theme', winner: false },
    ],
  ],
  nominationDataByGameId: [
    'nominationDataByGameId(gameId:9000) { gameId themeTitle winner }',
    [
      { gameId: 9000, themeTitle: 'Monthly theme', winner: false },
      { gameId: 9000, themeTitle: 'Annual theme', winner: false },
    ],
  ],
  nominationDataByUserId: [
    'nominationDataByUserId(userId:2) { gameId winner }',
    [
      { gameId: 5, winner: true },
      { gameId: 305, winner: true },
      { gameId: 9000, winner: false },
      { gameId: 9000, winner: false },
    ],
  ],
  nominationSuccessPercentByUser: [
    'nominationSuccessPercentByUser { id rank earnedPoints nominations wins successRate }',
    [
      {
        id: 2,
        rank: 1,
        earnedPoints: 12.5,
        nominations: 2,
        wins: 1,
        successRate: 50,
      },
      {
        id: 3,
        rank: 2,
        earnedPoints: 0,
        nominations: 0,
        wins: 0,
        successRate: 0,
      },
    ],
  ],
  nominations: [
    'nominations { id themeId gameId userId winner }',
    [
      { id: 50, themeId: 5, gameId: 5, userId: 2, winner: true },
      { id: 51, themeId: 5, gameId: 9000, userId: 2, winner: false },
      { id: 3050, themeId: 305, gameId: 305, userId: 2, winner: true },
      { id: 3051, themeId: 305, gameId: 9000, userId: 2, winner: false },
    ],
  ],
  shortestMonthsByAvgTimeToBeat: [
    'shortestMonthsByAvgTimeToBeat { theme value }',
    [{ theme: '2026-01-01 - Monthly theme', value: 20 }],
  ],
  themeDetailWithCategories: [
    'themeDetailWithCategories(themeId:5) { id gameId gameTitle winner screenscraperId yearCategory }',
    [
      {
        id: 5,
        gameId: 5,
        gameTitle: 'Monthly winner',
        winner: true,
        screenscraperId: '123',
        yearCategory: 'pre 96',
      },
      {
        id: 5,
        gameId: 9000,
        gameTitle: 'Shared game',
        winner: false,
        screenscraperId: null,
        yearCategory: '2k+',
      },
    ],
  ],
  themeWinners: [
    'themeWinners(themeId:5) { gameId title screenscraperId yearCategory }',
    [
      {
        gameId: 5,
        title: 'Monthly winner',
        screenscraperId: '123',
        yearCategory: 'pre 96',
      },
    ],
  ],
  themesWithStatus: [
    'themesWithStatus { id creationDate status nominationCount winnerCount }',
    [5, 305].map((id) => ({
      id,
      creationDate: '2026-01-01',
      status: 'completed',
      nominationCount: 2,
      winnerCount: 1,
    })),
  ],
  topNominationWinsByUser: [
    'topNominationWinsByUser { name wins }',
    [{ name: 'Public member', wins: 1 }],
  ],
  totalNomsBeforeWinByGame: [
    'totalNomsBeforeWinByGame { title total }',
    [{ title: 'Monthly winner', total: 1 }],
  ],
  totalTimeToBeatByMonth: [
    'totalTimeToBeatByMonth { theme value }',
    [{ theme: '2026-01-01 - Monthly theme', value: 20 }],
  ],
  user: [
    'user(id:2) { id name earnedPoints }',
    { id: 2, name: 'Public member', earnedPoints: 12.5 },
  ],
};

// Only unordered comparisons normalize arrays. Specific ordering is asserted below.
const canonical = (value) =>
  Array.isArray(value)
    ? value
        .map(canonical)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, canonical(item)]),
        )
      : value;
const ids = (rows) => rows.map((row) => row.id).sort((a, b) => a - b);
let context;
async function query(selection) {
  const result = await context.request(`{ ${selection} }`);
  assert.equal(result.status, 200);
  assert.equal(result.errors, undefined, JSON.stringify(result.errors));
  return result.data;
}
function assertPoolEnded(pool) {
  assert.equal(pool.ended, true);
  assert.equal(pool.totalCount, 0);
  assert.equal(pool.idleCount, 0);
}
function assertClosed(ctx) {
  assertPoolEnded(ctx.pool);
  assertPoolEnded(ctx.applicationPool);
  assert.equal(ctx.fastify.server.listening, false);
  assert.equal(ctx.fastify.server.address(), null);
  assert.equal(remainingContainer(ctx.containerId), '');
}

await describe('Fastify/PostgreSQL public API', { concurrency: false }, () => {
  before(async () => {
    context = await startTestContext();
  });
  // TRUNCATE commits on the fixture pool before every scenario. The independent
  // application pool sees the same clean DB; connection-local rollback is not used.
  beforeEach(async () => {
    await context.reset();
  });
  after(async () => {
    if (context) {
      await context.close();
      assertClosed(context);
    }
  });

  void it('detects query inventory drift and exposes only the public read schema', () => {
    // Arrange
    const schema = context.app.get(GraphQLSchemaHost).schema;
    // Act
    const fields = schema.getQueryType().getFields();
    // Assert
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(roots).sort());
    assert.equal(Object.keys(fields).length, 29);
    assert.equal(schema.getMutationType(), undefined);
    assert.deepEqual(Object.keys(schema.getType('User').getFields()).sort(), [
      'earnedPoints',
      'id',
      'name',
    ]);
    for (const [type, field] of [
      ['Game', 'screenscraperId'],
      ['Game', 'igdbId'],
      ['CurrentWinner', 'screenscraperId'],
      ['ThemeWinner', 'screenscraperId'],
      ['ThemeDetailEntry', 'screenscraperId'],
      ['GotyThemeDetail', 'winnerScreenscraperId'],
    ])
      assert.equal(String(schema.getType(type).getFields()[field].type), 'ID');
    assert.equal(String(fields.game.args[0].type), 'Int!');
    assert.equal(context.fastify.server.listening, false);
    assert.equal(context.app.getHttpAdapter().getType(), 'fastify');
  });

  for (const [name, [selection, expected]] of Object.entries(roots)) {
    void it(`${name}: returns meaningful public data`, async () => {
      // Arrange
      if (name === 'user') await seedMembers(context.pool);
      else if (name === 'game')
        await context.pool
          .query(`INSERT INTO games(id,title_world,screenscraper_id,igdb_id)
        VALUES (5,'Monthly winner',123,456)`);
      else if (name !== 'healthCheck') await seedPublicExample(context.pool);
      // Act
      const value = (await query(selection))[name];
      // Assert
      if (expected instanceof RegExp) assert.match(value, expected);
      else assert.deepEqual(canonical(value), canonical(expected));
    });
    void it(`${name}: handles an empty database`, async () => {
      // Arrange: beforeEach has committed the reset, with no scenario records.
      // Act
      const value = (await query(selection))[name];
      // Assert
      if (name === 'healthCheck') assert.match(value, expected);
      else
        assert.deepEqual(
          value,
          ['game', 'user'].includes(name)
            ? null
            : name === 'avgNominationsBeforeWin'
              ? 0
              : [],
        );
    });
    void it(`${name}: propagates a real PostgreSQL query failure through GraphQL`, async () => {
      // Arrange: controlled fault through the real pg pool, no fake SQL rows.
      // This deliberately replaces the statement, not a network-outage simulation.
      const original = context.database.query.bind(context.database);
      context.database.query = () => original('SELECT 1 / 0');
      try {
        // Act
        const result = await context.request(`{ ${selection} }`);
        // Assert
        assert.equal(result.status, 200);
        assert.equal(result.errors.length, 1);
        assert.deepEqual(result.errors[0].path, [name]);
        assert.equal(result.errors[0].extensions.code, 'INTERNAL_SERVER_ERROR');
        assert.match(result.errors[0].message, /division by zero/);
        assert.deepEqual(
          result.data,
          ['game', 'user'].includes(name) ? { [name]: null } : null,
        );
      } finally {
        context.database.query = original;
      }
    });
  }

  void it('keeps external identifiers exact through pg, every mapper and HTTP serialization', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    for (const value of [
      '123',
      '0',
      '9007199254740993',
      '9223372036854775807',
      '-9223372036854775808',
      null,
    ]) {
      await context.pool.query(
        'UPDATE games SET screenscraper_id=$1, igdb_id=$1 WHERE id IN (5,305)',
        [value],
      );
      // Act
      const result = await query(`game(id:5) { id screenscraperId igdbId }
        gamesByNomination(nominationType:"gotm",winner:true) { screenscraperId igdbId }
        currentWinners { screenscraperId }
        themeWinners(themeId:5) { screenscraperId }
        themeDetailWithCategories(themeId:5) { gameId screenscraperId }
        gotyThemesForYear(creationDate:"2026-01-01") { winnerGameId winnerScreenscraperId }`);
      // Assert
      assert.deepEqual(result.game, {
        id: 5,
        screenscraperId: value,
        igdbId: value,
      });
      assert.deepEqual(result.gamesByNomination, [
        { screenscraperId: value, igdbId: value },
      ]);
      assert.ok(
        result.currentWinners.every((row) => row.screenscraperId === value),
      );
      assert.deepEqual(result.themeWinners, [{ screenscraperId: value }]);
      assert.equal(
        result.themeDetailWithCategories.find((row) => row.gameId === 5)
          .screenscraperId,
        value,
      );
      assert.equal(
        result.gotyThemesForYear.find((row) => row.winnerGameId === 305)
          .winnerScreenscraperId,
        value,
      );
    }
  });

  void it('publishes winner-selected themes across dates and programs, never date-only themes', async () => {
    // Arrange
    await seedPublicationMatrix(context.pool);
    // Act
    const result = await query(
      'themesWithStatus { id creationDate } currentWinners { themeId nominationCount }',
    );
    // Assert
    assert.deepEqual(ids(result.themesWithStatus), publicIds);
    assert.ok(
      result.themesWithStatus.every((row) =>
        /^\d{4}-\d{2}-\d{2}$/.test(row.creationDate),
      ),
    );
    assert.deepEqual(
      result.currentWinners.map((row) => row.themeId).sort((a, b) => a - b),
      programs.map((_, p) => p * 100 + 5),
    );
    assert.ok(result.currentWinners.every((row) => row.nominationCount === 2));
    for (const id of [...privateIds, 99999]) {
      assert.deepEqual(
        await query(`themeDetailWithCategories(themeId:${id}) { id }
        themeWinners(themeId:${id}) { gameId } nominationDataByGameId(gameId:${id}) { gameId }`),
        {
          themeDetailWithCategories: [],
          themeWinners: [],
          nominationDataByGameId: [],
        },
      );
    }
    assert.equal(
      (await query('game(id:2) { id }')).game.id,
      2,
      'metadata is not embargoed',
    );
    assert.deepEqual(
      (await query('nominationDataByUserId(userId:3) { gameId }'))
        .nominationDataByUserId,
      [],
    );
    assert.equal(
      (await query('completionsByUserId(userId:2) { id }')).completionsByUserId
        .length,
      30,
    );
    for (const [p, program] of programs.entries()) {
      for (const winner of [true, false]) {
        const rows = (
          await query(
            `gamesByNomination(nominationType:"${program}",winner:${winner}) { id }`,
          )
        ).gamesByNomination;
        assert.deepEqual(
          ids(rows),
          winner ? [p * 100 + 1, p * 100 + 3, p * 100 + 5] : [9000],
        );
      }
      assert.equal(
        (await query(`nominations(nominationType:"${program}") { id }`))
          .nominations.length,
        6,
      );
      assert.equal(
        (
          await query(
            `mostCompletedGames(nominationType:"${program}") { title }`,
          )
        ).mostCompletedGames.length,
        4,
      );
      assert.equal(
        (
          await query(
            `newestCompletions(nominationType:"${program}") { title }`,
          )
        ).newestCompletions.length,
        6,
      );
    }
    assert.equal(
      (await query('nominationData { gameId }')).nominationData.length,
      30,
    );
    assert.equal(
      (await query('nominationDataByUserId(userId:2) { gameId }'))
        .nominationDataByUserId.length,
      30,
    );
    assert.equal(
      (await query('nominationDataByGameId(gameId:9000) { gameId }'))
        .nominationDataByGameId.length,
      15,
    );
  });

  void it('all public responses and aggregate denominators ignore private/orphan nominations', async () => {
    // Arrange
    await seedPublicationMatrix(context.pool);
    const before = {};
    for (const [name, [selection]] of Object.entries(roots))
      if (name !== 'healthCheck')
        before[name] = canonical((await query(selection))[name]);
    const dates = (
      await context.pool.query(
        "SELECT DISTINCT TO_CHAR(creation_date,'YYYY-MM-DD') AS date FROM themes WHERE nomination_type='goty'",
      )
    ).rows;
    const gotySelections = dates.map(
      ({ date }) =>
        `gotyThemesForYear(creationDate:"${date}") { id title description nominationCount winnerCount winnerGameId }`,
    );
    const beforeGoty = [];
    for (const selection of gotySelections)
      beforeGoty.push(canonical(await query(selection)));
    const typedSelections = programs.flatMap((program) => [
      `mostCompletedGames(nominationType:"${program}") { title completions }`,
      `newestCompletions(nominationType:"${program}") { title completions }`,
    ]);
    const beforeTyped = [];
    for (const selection of typedSelections)
      beforeTyped.push(canonical(await query(selection)));
    // Act: deleting hidden data must not change any public result.
    await context.pool.query(
      'DELETE FROM nominations WHERE theme_id=ANY($1::bigint[]) OR theme_id IS NULL OR theme_id=99999',
      [privateIds],
    );
    await context.pool.query('DELETE FROM themes WHERE id=ANY($1::bigint[])', [
      privateIds,
    ]);
    // Assert
    for (const [name, [selection]] of Object.entries(roots))
      if (name !== 'healthCheck')
        assert.deepEqual(
          canonical((await query(selection))[name]),
          before[name],
          name,
        );
    for (const [index, selection] of gotySelections.entries())
      assert.deepEqual(
        canonical(await query(selection)),
        beforeGoty[index],
        selection,
      );
    for (const [index, selection] of typedSelections.entries())
      assert.deepEqual(
        canonical(await query(selection)),
        beforeTyped[index],
        selection,
      );
    // GOTY dates depend on CURRENT_DATE in this fixture; query its actual date too.
    const summaries = (
      await query(
        'gotyThemesByYear { creationDate themeCount totalWinners categoryTitles }',
      )
    ).gotyThemesByYear;
    assert.equal(summaries.length, 3);
    for (const row of summaries) {
      assert.equal(row.themeCount, 1);
      assert.equal(row.totalWinners, 1);
      assert.equal(row.categoryTitles.length, 1);
      const detail = (
        await query(
          `gotyThemesForYear(creationDate:"${row.creationDate}") { id }`,
        )
      ).gotyThemesForYear;
      assert.ok(detail.every((item) => publicIds.includes(item.id)));
    }
    assert.deepEqual(
      (await query('mostNominatedGames(losersOnly:true) { title total }'))
        .mostNominatedGames,
      [{ title: 'Shared game', total: 3 }],
    );
  });

  void it('retains latest-date ID tie breaks and all winners on the chosen theme', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool
      .query(`INSERT INTO themes VALUES (7,'Tie','Tie','2026-01-01','gotm');
      INSERT INTO nominations VALUES (70,'gotm','First',true,5,2,7),(71,'gotm','Second',true,9000,2,7);`);
    // Act
    const rows = (
      await query(
        'currentWinners { themeId gameId nominationType nominationCount }',
      )
    ).currentWinners.filter((row) => row.nominationType === 'gotm');
    // Assert
    assert.equal(rows.length, 2);
    assert.ok(
      rows.every((row) => row.themeId === 7 && row.nominationCount === 2),
    );
    assert.deepEqual(
      rows.map((row) => row.gameId).sort((a, b) => a - b),
      [5, 9000],
    );
  });

  void it('counts duplicate nominations without duplicating randomizer pool entries', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool.query(
      "INSERT INTO nominations VALUES (80,'gotm','Duplicate',false,9000,2,5)",
    );
    // Act
    const result = await query(
      'gamesByNomination(nominationType:"gotm") { id } nominations(nominationType:"gotm") { id } mostNominatedGames(losersOnly:true) { title total }',
    );
    // Assert
    assert.deepEqual(ids(result.gamesByNomination), [5, 9000]);
    assert.equal(result.nominations.length, 3);
    assert.deepEqual(result.mostNominatedGames, [
      { title: 'Shared game', total: 2 },
    ]);
  });

  void it('preserves null/missing relationships, fallback titles, durations and achievement defaults', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool.query(`INSERT INTO games(id) VALUES (9100);
      INSERT INTO users(id,name) VALUES (4,'Null points');
      INSERT INTO nominations VALUES (91000,'gotm',NULL,false,NULL,NULL,5),(91001,'gotm',NULL,false,91999,91999,5);
      UPDATE games SET time_to_beat=NULL WHERE id=5;
      UPDATE completions SET rpg_achievements=NULL WHERE id=50;`);
    // Act
    const result =
      await query(`game(id:9100) { title systems screenscraperId igdbId }
      user(id:4) { earnedPoints } nominationDataByGameId(gameId:91999) { gameId title userName gameDescription }
      nominations { id gameId userId description } completionsByUserId(userId:2) { id rpgAchievements }
      nominationSuccessPercentByUser { id earnedPoints nominations wins successRate }`);
    // Assert
    assert.deepEqual(result.game, {
      title: 'Untitled',
      systems: null,
      screenscraperId: null,
      igdbId: null,
    });
    assert.deepEqual(result.user, { earnedPoints: null });
    assert.deepEqual(result.nominationDataByGameId, [
      { gameId: 91999, title: null, userName: null, gameDescription: null },
    ]);
    assert.deepEqual(
      result.nominations.find((row) => row.id === 91000),
      { id: 91000, gameId: null, userId: null, description: null },
    );
    assert.equal(
      result.completionsByUserId.find((row) => row.id === 50).rpgAchievements,
      false,
    );
    assert.deepEqual(
      result.nominationSuccessPercentByUser.find((row) => row.id === 4),
      { id: 4, earnedPoints: 0, nominations: 0, wins: 0, successRate: 0 },
    );
    for (const field of [
      'avgTimeToBeatByMonth',
      'totalTimeToBeatByMonth',
      'longestMonthsByAvgTimeToBeat',
      'shortestMonthsByAvgTimeToBeat',
    ])
      assert.deepEqual((await query(`${field} { value }`))[field], [
        { value: null },
      ]);
    await context.pool.query(
      "UPDATE games SET title_usa='Regional fallback' WHERE id=9100",
    );
    assert.equal(
      (await query('game(id:9100) { title }')).game.title,
      'Regional fallback',
    );
    assert.deepEqual(
      await query(
        'game(id:99999) { id } user(id:99999) { id } completionsByUserId(userId:99999) { id }',
      ),
      { game: null, user: null, completionsByUserId: [] },
    );
  });

  void it('rejects private member fields, invalid arguments and injection-shaped program filters', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    const invalid = [
      'game(id:"bad") { id }',
      'user(id:2147483648) { id }',
      'themeWinners { gameId }',
      ...[
        'discordId',
        'admin',
        'currentPoints',
        'redeemedPoints',
        'premiumPoints',
        'premiumSubscriber',
      ].map((field) => `user(id:2) { ${field} }`),
    ];
    for (const selection of invalid) {
      // Act
      const result = await context.request(`{ ${selection} }`);
      // Assert
      assert.equal(result.status, 400);
      assert.equal(result.data, undefined);
      assert.equal(
        result.errors[0].extensions.code,
        'GRAPHQL_VALIDATION_FAILED',
      );
    }
    assert.deepEqual(
      (await query('nominations(nominationType:"gotm\u0027 OR 1=1 --") { id }'))
        .nominations,
      [],
    );
    const ordered = (await query('mostCompletedGames { title completions }'))
      .mostCompletedGames;
    assert.deepEqual(ordered[0], { title: 'Shared game', completions: 2 });
  });

  void it('closes resources acquired before a setup failure', async () => {
    // Arrange
    const failure = new Error('test setup failure');
    let acquired;
    // Act
    await assert.rejects(
      startTestContext({
        initialize: async (resources) => {
          acquired = resources;
          assert.ok(resources.pool.totalCount > 0);
          throw failure;
        },
      }),
      (error) => error === failure,
    );
    // Assert: inspect actual resources outside the failed helper.
    assert.ok(acquired);
    assertPoolEnded(acquired.pool);
    assert.equal(remainingContainer(acquired.containerId), '');
  });

  // Last scenario intentionally closes the shared context. after() is idempotent.
  void it('closes the real app, both pools and database when an assertion escapes', async () => {
    // Arrange
    assert.ok(context.applicationPool.totalCount > 0);
    assert.equal(context.fastify.server.listening, false);
    // Act
    await assert.rejects(
      async () => {
        try {
          assert.fail('test assertion failure');
        } finally {
          await context.close();
        }
      },
      { name: 'AssertionError', message: 'test assertion failure' },
    );
    // Assert
    assertClosed(context);
  });
});
