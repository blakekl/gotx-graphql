// Native compiler metadata is required at this seam, just as in deployment.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, beforeEach, after, describe, it } from 'node:test';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { loadTheme, categoryRows, loadDashboard } from './public-operations.ts';
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
    'nominationCountByThemeByCategory { themeId title category count }',
    [
      { themeId: 5, title: 'Monthly theme', category: 'pre 96', count: 1 },
      { themeId: 5, title: 'Monthly theme', category: '2k+', count: 1 },
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
  themeYearCategories: [
    'themeYearCategories(themeId:5) { key label minYear maxYear }',
    [
      { key: 'PRE_96', label: 'pre 96', minYear: null, maxYear: 1995 },
      { key: 'MID', label: '96-99', minYear: 1996, maxYear: 1999 },
      { key: 'RECENT', label: '2k+', minYear: 2000, maxYear: null },
      { key: 'UNKNOWN', label: 'Unknown', minYear: null, maxYear: null },
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
    assert.equal(
      String(fields.themeYearCategories.type),
      '[ThemeYearCategory!]!',
    );
    assert.equal(String(fields.themeYearCategories.args[0].type), 'Int!');
    assert.equal(
      String(schema.getType('ThemeCategoryCountStat').getFields().themeId.type),
      'Int!',
    );
    assert.equal(
      String(
        schema.getType('UserNominationSuccessStat').getFields().successRate
          .type,
      ),
      'Float!',
    );
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(schema.getType('ThemeYearCategory').getFields()).map(
          ([name, field]) => [name, String(field.type)],
        ),
      ),
      {
        key: 'String!',
        label: 'String!',
        minYear: 'Int',
        maxYear: 'Int',
      },
    );
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

    const ordered = (await query('mostCompletedGames { title completions }'))
      .mostCompletedGames;
    assert.deepEqual(ordered[0], { title: 'Shared game', completions: 2 });
  });

  void it('derives current winner categories rather than returning Unknown', async () => {
    await seedPublicExample(context.pool);
    const result = await query('currentWinners { yearCategory }');
    assert.deepEqual(result.currentWinners, [
      { yearCategory: 'pre 96' },
      { yearCategory: 'pre 96' },
    ]);
  });

  void it('handles overflowing year text without PostgreSQL cast failures', async () => {
    await seedPublicExample(context.pool);
    await context.pool.query(
      "UPDATE games SET year='999999999999999999999' WHERE id=5",
    );
    const result = await query('themeWinners(themeId:5) { yearCategory }');
    assert.deepEqual(result.themeWinners, [{ yearCategory: 'Unknown' }]);
  });

  void it('classifies historical and modern categories consistently, including unsafe year text', async () => {
    // Arrange: same titles require theme IDs in chart rows; every game wins so
    // all four classification paths can be compared on the identical fixture.
    const years = [
      '1995',
      '1996',
      '1999',
      '2000',
      '2001',
      '2002',
      null,
      'unknown',
      '19x6',
      '999999999999999999999999',
      '2147483648',
    ];
    await context.pool.query(`INSERT INTO themes VALUES
      (234,'Same title',NULL,'2026-01-01','gotm'),
      (235,'Same title',NULL,'2026-02-01','gotm')`);
    for (const [index, year] of years.entries()) {
      const gameId = index + 1;
      await context.pool.query('INSERT INTO games(id,year) VALUES ($1,$2)', [
        gameId,
        year,
      ]);
      for (const themeId of [234, 235])
        await context.pool.query(
          "INSERT INTO nominations VALUES ($1,'gotm',NULL,true,$2,NULL,$3)",
          [themeId * 100 + index, gameId, themeId],
        );
    }
    for (const themeId of [234, 235]) {
      // Act: promote each theme in turn without changing its historical ID.
      await context.pool.query(
        "UPDATE themes SET creation_date=CASE WHEN id=$1 THEN DATE '2026-03-01' ELSE DATE '2026-01-01' END",
        [themeId],
      );
      const result =
        await query(`themeDetailWithCategories(themeId:${themeId}) { gameId yearCategory }
        themeWinners(themeId:${themeId}) { gameId yearCategory }
        currentWinners { gameId yearCategory }
        nominationCountByThemeByCategory { themeId category count }`);
      // Assert
      const labels =
        themeId === 234
          ? ['pre 96', '96-99', '96-99', '2k+', '2k+', '2k+']
          : ['pre 96', '96-01', '96-01', '96-01', '96-01', '02+'];
      const expected = years.map((_, index) => ({
        gameId: index + 1,
        yearCategory: labels[index] ?? 'Unknown',
      }));
      for (const field of [
        'themeDetailWithCategories',
        'themeWinners',
        'currentWinners',
      ])
        assert.deepEqual(canonical(result[field]), canonical(expected), field);
      const counts = Object.entries(
        expected.reduce((acc, row) => {
          acc[row.yearCategory] = (acc[row.yearCategory] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([category, count]) => ({ themeId, category, count }));
      assert.deepEqual(
        canonical(
          result.nominationCountByThemeByCategory.filter(
            (row) => row.themeId === themeId,
          ),
        ),
        canonical(counts),
      );
    }
  });

  void it('returns ordered public category definitions even for unoccupied buckets', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool
      .query(`INSERT INTO themes VALUES (234,'Old',NULL,'2026-01-01','gotm'),
      (235,'New',NULL,'2026-01-01','gotm'), (236,'Private',NULL,'2000-01-01','gotm');
      INSERT INTO nominations VALUES (2340,'gotm',NULL,true,5,NULL,234), (2350,'gotm',NULL,true,5,NULL,235);`);
    for (const themeId of [234, 235, 236, 99999]) {
      // Act
      const rows = (
        await query(
          `themeYearCategories(themeId:${themeId}) { key label minYear maxYear }`,
        )
      ).themeYearCategories;
      // Assert
      assert.deepEqual(
        rows,
        themeId > 235
          ? []
          : [
              { key: 'PRE_96', label: 'pre 96', minYear: null, maxYear: 1995 },
              {
                key: 'MID',
                label: themeId < 235 ? '96-99' : '96-01',
                minYear: 1996,
                maxYear: themeId < 235 ? 1999 : 2001,
              },
              {
                key: 'RECENT',
                label: themeId < 235 ? '2k+' : '02+',
                minYear: themeId < 235 ? 2000 : 2002,
                maxYear: null,
              },
              {
                key: 'UNKNOWN',
                label: 'Unknown',
                minYear: null,
                maxYear: null,
              },
            ],
      );
    }
  });

  void it('retains fractional success percentages and points with a safe zero denominator', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool.query(
      "INSERT INTO nominations VALUES (80,'gotm',NULL,false,9000,2,5)",
    );
    // Act
    const result = await query(
      'user(id:2) { earnedPoints } nominationSuccessPercentByUser { id earnedPoints successRate nominations wins }',
    );
    // Assert
    assert.equal(result.user.earnedPoints, 12.5);
    const member = result.nominationSuccessPercentByUser.find(
      (row) => row.id === 2,
    );
    assert.equal(member.earnedPoints, 12.5);
    assert.equal(member.nominations, 3);
    assert.equal(member.wins, 1);
    assert.ok(Math.abs(member.successRate - 100 / 3) < 1e-12);
    assert.equal(
      result.nominationSuccessPercentByUser.find((row) => row.id === 3)
        .successRate,
      0,
    );
  });

  void it('rejects invalid internal IDs, programs and calendar dates without SQL internals', async () => {
    // Arrange
    const invalid = [
      ...[
        'game(id:VALUE) { id }',
        'user(id:VALUE) { id }',
        'nominationDataByGameId(gameId:VALUE) { gameId }',
        'nominationDataByUserId(userId:VALUE) { gameId }',
        'completionsByUserId(userId:VALUE) { id }',
        'themeDetailWithCategories(themeId:VALUE) { id }',
        'themeWinners(themeId:VALUE) { gameId }',
        'themeYearCategories(themeId:VALUE) { key }',
      ].flatMap((selection) =>
        [0, -1].map((value) => selection.replace('VALUE', String(value))),
      ),
      ...[
        'gamesByNomination',
        'nominations',
        'mostCompletedGames',
        'newestCompletions',
      ].flatMap((field) =>
        ['', 'other', "gotm' OR 1=1 --"].map(
          (value) =>
            `${field}(nominationType:${JSON.stringify(value)}) { ${field === 'nominations' || field === 'gamesByNomination' ? 'id' : 'title'} }`,
        ),
      ),
      ...[
        '2026-02-29',
        '1900-02-29',
        '2026-04-31',
        '2026-13-01',
        '2026-00-01',
        '2026-01-00',
        '0000-01-01',
        '2026-1-01',
        '2026-01-01T00:00:00Z',
        "bad'::date",
      ].map(
        (date) =>
          `gotyThemesForYear(creationDate:${JSON.stringify(date)}) { id }`,
      ),
    ];
    const original = context.database.query.bind(context.database);
    let databaseCalls = 0;
    context.database.query = (...args) => {
      databaseCalls++;
      return original(...args);
    };
    try {
      for (const selection of invalid) {
        // Act
        const result = await context.request(`{ ${selection} }`);
        // Assert
        assert.equal(
          result.errors?.[0]?.extensions.code,
          'BAD_USER_INPUT',
          selection,
        );
        assert.doesNotMatch(
          result.errors[0].message,
          /SELECT|syntax|::|postgres|out of range/i,
        );
      }
      assert.equal(
        databaseCalls,
        0,
        'invalid arguments never reach PostgreSQL',
      );
    } finally {
      context.database.query = original;
    }
    for (const date of ['2024-02-29', '2000-02-29', '0001-01-01', '9999-12-31'])
      assert.deepEqual(
        (await query(`gotyThemesForYear(creationDate:"${date}") { id }`))
          .gotyThemesForYear,
        [],
      );
    assert.deepEqual(
      await query(`game(id:2147483647) { id } user(id:2147483647) { id }
      nominationDataByGameId(gameId:2147483647) { gameId } nominationDataByUserId(userId:2147483647) { gameId }
      completionsByUserId(userId:2147483647) { id } themeWinners(themeId:2147483647) { gameId }
      themeDetailWithCategories(themeId:2147483647) { id } themeYearCategories(themeId:2147483647) { key }`),
      {
        game: null,
        user: null,
        nominationDataByGameId: [],
        nominationDataByUserId: [],
        completionsByUserId: [],
        themeWinners: [],
        themeDetailWithCategories: [],
        themeYearCategories: [],
      },
    );
  });

  void it('uses regional title priority through every title projection, with Untitled for a titleless game', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    const columns = [
      'title_world',
      'title_usa',
      'title_eu',
      'title_jp',
      'title_other',
    ];
    await context.pool.query(
      `UPDATE games SET title_world='World',title_usa='USA',title_eu='EU',title_jp='JP',title_other='Other'`,
    );
    for (const [index, expected] of [
      'World',
      'USA',
      'EU',
      'JP',
      'Other',
      'Untitled',
    ].entries()) {
      if (index > 0)
        await context.pool.query(`UPDATE games SET ${columns[index - 1]}=NULL`);
      // Act
      const result =
        await query(`game(id:5) { title } gamesByNomination(nominationType:"gotm") { title }
        currentWinners { title } themeWinners(themeId:5) { title }
        themeDetailWithCategories(themeId:5) { gameTitle } nominationDataByGameId(gameId:5) { title }
        completionsByUserId(userId:2) { title } mostCompletedGames { title }
        gotyThemesForYear(creationDate:"2026-01-01") { winnerGameId winnerTitle }`);
      // Assert
      assert.equal(result.game.title, expected);
      for (const field of [
        'gamesByNomination',
        'currentWinners',
        'themeWinners',
        'nominationDataByGameId',
        'completionsByUserId',
        'mostCompletedGames',
      ])
        assert.ok(
          result[field].every((row) => row.title === expected),
          field,
        );
      assert.ok(
        result.themeDetailWithCategories.every(
          (row) => row.gameTitle === expected,
        ),
      );
      assert.equal(
        result.gotyThemesForYear.find((row) => row.winnerGameId === 305)
          .winnerTitle,
        expected,
      );
      assert.equal(
        result.gotyThemesForYear.find((row) => row.winnerGameId === null)
          .winnerTitle,
        null,
      );
    }
  });

  void it('executes typed consumer operations with variables, empty categories and exact identifiers', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool.query(
      'UPDATE games SET screenscraper_id=9007199254740993 WHERE id=5',
    );
    const send = async (document, variables) => {
      const result = await context.request(document, variables);
      assert.equal(result.status, 200);
      assert.equal(result.errors, undefined, JSON.stringify(result.errors));
      return result.data;
    };
    // Act
    const view = await loadTheme(send, 5);
    const dashboard = await loadDashboard(send, 'gotm', '2026-01-01');
    // Assert
    assert.deepEqual(categoryRows(view, 5), [
      { key: 'PRE_96', label: 'pre 96', count: 1 },
      { key: 'MID', label: '96-99', count: 0 },
      { key: 'RECENT', label: '2k+', count: 1 },
      { key: 'UNKNOWN', label: 'Unknown', count: 0 },
    ]);
    assert.equal(
      view.themeDetailWithCategories.find((row) => row.gameId === 5)
        .screenscraperId,
      '9007199254740993',
    );
    assert.equal(
      dashboard.gamesByNomination.find((row) => row.id === 5).screenscraperId,
      '9007199254740993',
    );
    assert.equal(
      dashboard.nominationSuccessPercentByUser.find((row) => row.id === 2)
        .earnedPoints,
      12.5,
    );
    assert.ok(
      dashboard.gotyThemesForYear.every(
        (row) => row.creationDate === '2026-01-01',
      ),
    );
    assert.deepEqual(categoryRows(await loadTheme(send, 99999), 99999), []);
  });

  void it('preserves program-local runner-up exclusions and omitted optional filters', async () => {
    // Arrange: a game wins GOTY, loses GOTM twice, then wins GOTM too.
    await seedPublicExample(context.pool);
    await context.pool.query(`INSERT INTO nominations VALUES
      (80,'gotm',NULL,false,305,2,5),(81,'gotm',NULL,false,305,2,5)`);
    // Act / Assert
    assert.deepEqual(
      ids(
        (
          await query(
            'gamesByNomination(nominationType:"gotm",winner:false) { id }',
          )
        ).gamesByNomination,
      ),
      [305, 9000],
    );
    await context.pool.query(
      "INSERT INTO nominations VALUES (82,'gotm',NULL,true,305,2,5)",
    );
    assert.deepEqual(
      ids(
        (
          await query(
            'gamesByNomination(nominationType:"gotm",winner:false) { id }',
          )
        ).gamesByNomination,
      ),
      [9000],
    );
    assert.deepEqual(
      ids(
        (await query('gamesByNomination(nominationType:"gotm") { id }'))
          .gamesByNomination,
      ),
      [5, 305, 9000],
    );
    for (const [unfiltered, explicitNull] of [
      ['nominations { id }', 'nominations(nominationType:null) { id }'],
      [
        'mostCompletedGames { title completions }',
        'mostCompletedGames(nominationType:null) { title completions }',
      ],
      [
        'newestCompletions { title completions }',
        'newestCompletions(nominationType:null) { title completions }',
      ],
    ])
      assert.deepEqual(
        canonical(await query(unfiltered)),
        canonical(await query(explicitNull)),
      );
  });

  void it('preserves established sums, before-win eligibility and GOTY date/game groups', async () => {
    // Arrange: GOTM has two winners (20+10), repeated losing nominations still
    // count; cross-program nominations of a GOTM-winning game count before-win.
    await seedPublicExample(context.pool);
    await context.pool.query(`UPDATE nominations SET winner=true WHERE id=51;
      INSERT INTO nominations VALUES (80,'gotm',NULL,false,5,2,5),
      (81,'goty',NULL,true,9000,2,305), (82,'goty',NULL,false,5,2,305);
      INSERT INTO themes VALUES (306,'Other award',NULL,'2026-01-01','goty'),
        (307,'Other date',NULL,'2026-02-01','goty');
      INSERT INTO nominations VALUES (3060,'goty',NULL,true,5,2,306),
        (3070,'goty',NULL,true,305,2,307);`);
    // Act
    const result =
      await query(`avgTimeToBeatByMonth { value } totalTimeToBeatByMonth { value }
      longestMonthsByAvgTimeToBeat { value } shortestMonthsByAvgTimeToBeat { value }
      totalNomsBeforeWinByGame { title total } avgNominationsBeforeWin
      gotyThemesByYear { creationDate themeCount totalWinners }
      gotyThemesForYear(creationDate:"2026-01-01") { id winnerGameId nominationCount winnerCount }`);
    // Assert
    assert.deepEqual(result.avgTimeToBeatByMonth, [{ value: 15 }]);
    for (const field of [
      'totalTimeToBeatByMonth',
      'longestMonthsByAvgTimeToBeat',
      'shortestMonthsByAvgTimeToBeat',
    ])
      assert.deepEqual(result[field], [{ value: 30 }]);
    assert.deepEqual(
      canonical(result.totalNomsBeforeWinByGame),
      canonical([
        { title: 'Monthly winner', total: 4 },
        { title: 'Shared game', total: 3 },
      ]),
    );
    assert.equal(result.avgNominationsBeforeWin, 3.5);
    assert.deepEqual(result.gotyThemesByYear, [
      { creationDate: '2026-02-01', themeCount: 1, totalWinners: 1 },
      { creationDate: '2026-01-01', themeCount: 2, totalWinners: 3 },
    ]);
    // Existing GROUP BY theme and winner game preserves a null-game group for
    // nonwinners, not a recomputed per-theme total on each winner row.
    assert.deepEqual(
      canonical(result.gotyThemesForYear),
      canonical([
        { id: 305, winnerGameId: 305, nominationCount: 1, winnerCount: 1 },
        { id: 305, winnerGameId: 9000, nominationCount: 1, winnerCount: 1 },
        { id: 305, winnerGameId: null, nominationCount: 2, winnerCount: 0 },
        { id: 306, winnerGameId: 5, nominationCount: 1, winnerCount: 1 },
      ]),
    );
  });

  void it('preserves normalized arrays, year text, achievement aliases and calendar date projections', async () => {
    // Arrange
    await seedPublicExample(context.pool);
    await context.pool
      .query(`UPDATE games SET systems=ARRAY['SNES','PS'],genres=ARRAY['RPG'],year='2001' WHERE id=5;
      UPDATE completions SET completed_at=TIMESTAMP '2024-02-29 23:59:59',rpg_achievements=true WHERE id=50;`);
    // Act
    const result = await query(`game(id:5) { year systems genres }
      completionsByUserId(userId:2) { id date rpgAchievements }
      themesWithStatus { creationDate } nominationData { date }`);
    // Assert
    assert.deepEqual(result.game, {
      year: '2001',
      systems: ['SNES', 'PS'],
      genres: ['RPG'],
    });
    assert.deepEqual(
      result.completionsByUserId.find((row) => row.id === 50),
      { id: 50, date: '2024-02-29', rpgAchievements: true },
    );
    assert.ok(
      result.themesWithStatus.every((row) => row.creationDate === '2026-01-01'),
    );
    assert.ok(result.nominationData.every((row) => row.date === '2026-01-01'));
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
