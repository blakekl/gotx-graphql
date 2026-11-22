import { describe, expect, it, vi } from 'vitest';
import { DatabaseService } from '../src/database/database.service.js';
import { GamesService } from '../src/games/games.service.js';
import { UsersService } from '../src/users/users.service.js';
import { NominationsService } from '../src/nominations/nominations.service.js';
import { CompletionsService } from '../src/completions/completions.service.js';
import { ThemesService } from '../src/themes/themes.service.js';
import { StatsService } from '../src/stats/stats.service.js';

// Raw driver-shaped rows isolate mapping only. SQL/publication correctness is
// separately exercised against PostgreSQL in public-boundary and Fastify e2e.
const database = (rows: Record<string, unknown>[]) => {
  const query = vi.fn().mockResolvedValue({ rows });
  return { query, service: { query } as unknown as DatabaseService };
};

describe('service mapper contracts', () => {
  it('maps bigint strings, zero, null and arrays without losing external IDs', async () => {
    const db = database([
      {
        id: '5',
        title: null,
        title_world: null,
        title_usa: 'Regional title',
        title_eu: null,
        title_jp: null,
        title_other: null,
        year: null,
        systems: ['SNES'],
        developer: null,
        genres: [],
        img_url: null,
        time_to_beat: 0,
        screenscraper_id: '4294967297',
        igdb_id: '4294967298',
      },
    ]);
    expect(await new GamesService(db.service).findById(5)).toEqual({
      id: 5,
      title: 'Untitled',
      titleWorld: undefined,
      titleUsa: 'Regional title',
      titleEu: undefined,
      titleJp: undefined,
      titleOther: undefined,
      year: undefined,
      systems: ['SNES'],
      developer: undefined,
      genres: [],
      imgUrl: undefined,
      timeToBeat: 0,
      screenscraperId: 4294967297,
      igdbId: 4294967298,
    });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [5],
    );
  });

  it('returns null for missing single records and retains fractional/zero/null points', async () => {
    const empty = database([]);
    expect(await new GamesService(empty.service).findById(99)).toBeNull();
    expect(await new UsersService(empty.service).findById(99)).toBeNull();
    for (const points of [12.5, 0, null]) {
      const db = database([
        {
          id: '2',
          name: 'Synthetic',
          earned_points: points,
          discord_id: 'private',
          admin: true,
          current_points: 999,
        },
      ]);
      expect(await new UsersService(db.service).findById(2)).toEqual({
        id: 2,
        name: 'Synthetic',
        earnedPoints: points ?? undefined,
      });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, earned_points'),
        [2],
      );
    }
  });

  it('maps missing nomination relationships and preserves false/zero values', async () => {
    const db = database([
      {
        id: '10',
        nomination_type: 'gotm',
        description: null,
        winner: false,
        game_id: null,
        user_id: '0',
        theme_id: '5',
      },
    ]);
    expect(await new NominationsService(db.service).findAll('gotm')).toEqual([
      {
        id: 10,
        nominationType: 'gotm',
        description: undefined,
        winner: false,
        gameId: undefined,
        userId: 0,
        themeId: 5,
      },
    ]);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE nomination_type = $1'),
      ['gotm'],
    );
  });

  it('maps nullable completion attributes without converting SQL dates to instants', async () => {
    const db = database([
      {
        id: '10',
        title: null,
        date: '2026-01-02',
        nomination_type: 'rpg',
        theme_id: '5',
        rpg_achievements: null,
      },
    ]);
    expect(
      await new CompletionsService(db.service).findByUserId(2),
    ).toMatchObject([
      {
        id: 10,
        title: 'Untitled',
        date: '2026-01-02',
        nominationType: 'rpg',
        themeId: 5,
        rpgAchievements: false,
      },
    ]);
  });

  it('maps nullable duration and decimal SQL aggregates', async () => {
    const db = database([
      { theme: 'Synthetic', value: '12.5' },
      { theme: 'Null duration', value: null },
    ]);
    expect(
      await new StatsService(db.service).findTimeToBeatByMonth('avg'),
    ).toEqual([
      { theme: 'Synthetic', value: 12.5 },
      { theme: 'Null duration', value: undefined },
    ]);
    const empty = database([]);
    expect(
      await new StatsService(empty.service).findAvgNominationsBeforeWin(),
    ).toBe(0);
  });

  it('propagates database failures from every service rather than returning plausible empty data', async () => {
    const failure = new Error('synthetic database failure');
    const query = vi.fn().mockRejectedValue(failure);
    const db = { query } as unknown as DatabaseService;
    for (const operation of [
      () => new GamesService(db).findById(5),
      () => new UsersService(db).findById(2),
      () => new NominationsService(db).findAll(),
      () => new CompletionsService(db).findByUserId(2),
      () => new ThemesService(db).findCurrentWinners(),
      () => new StatsService(db).findMostCompletedGames(),
    ])
      await expect(operation()).rejects.toBe(failure);
  });
});
