import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  GameCompletionStat,
  GameNominationCompletionStat,
  GameNominationCountStat,
  ThemeCategoryCountStat,
  ThemeTimeToBeatStat,
  UserNominationCountStat,
  UserNominationSuccessStat,
  UserWinStat,
} from './dto/stats.models.js';

const COALESCED_TITLE = `
  COALESCE(
    g.title_world,
    g.title_usa,
    g.title_eu,
    g.title_jp,
    g.title_other,
    'Untitled'
  )
`;

const toOptionalInt = (
  val: number | string | null | undefined,
): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Injectable()
export class StatsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findMostCompletedGames(
    nominationType?: string,
  ): Promise<GameCompletionStat[]> {
    const params: unknown[] = [];
    const whereClause = nominationType ? 'WHERE n.nomination_type = $1' : '';
    if (nominationType) {
      params.push(nominationType);
    }

    const sql = `
      SELECT
        ${COALESCED_TITLE} AS title,
        COUNT(*)::int AS completions
      FROM public.games g
      INNER JOIN public.nominations n ON n.game_id = g.id
      INNER JOIN public.completions c ON c.nomination_id = n.id
      ${whereClause}
      GROUP BY g.id
      ORDER BY completions DESC, title ASC;
    `;

    const result = await this.databaseService.query(sql, params);
    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      completions: Number(row.completions ?? 0),
    }));
  }

  async findNewestCompletions(
    nominationType?: string,
  ): Promise<GameCompletionStat[]> {
    const params: unknown[] = [];
    const whereClause = nominationType ? 'WHERE n.nomination_type = $1' : '';
    if (nominationType) {
      params.push(nominationType);
    }

    const sql = `
      SELECT
        ${COALESCED_TITLE} AS title,
        COUNT(*)::int AS completions
      FROM public.completions c
      INNER JOIN public.nominations n ON c.nomination_id = n.id
      INNER JOIN public.games g ON n.game_id = g.id
      INNER JOIN public.themes t ON n.theme_id = t.id
      ${whereClause}
      GROUP BY n.id, g.id, t.creation_date
      ORDER BY t.creation_date DESC, title ASC;
    `;

    const result = await this.databaseService.query(sql, params);
    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      completions: Number(row.completions ?? 0),
    }));
  }

  async findTotalNomsBeforeWinByGame(): Promise<GameNominationCountStat[]> {
    const sql = `
      SELECT
        ${COALESCED_TITLE} AS title,
        COUNT(*)::int AS total
      FROM public.nominations n
      INNER JOIN public.games g ON n.game_id = g.id
      WHERE n.game_id IN (
        SELECT game_id
        FROM public.nominations
        WHERE winner = true AND nomination_type = 'gotm' AND game_id IS NOT NULL
      )
      GROUP BY g.id
      ORDER BY total DESC, title ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      total: Number(row.total ?? 0),
    }));
  }

  async findAvgNominationsBeforeWin(): Promise<number> {
    const sql = `
      SELECT COALESCE(AVG(total), 0)::float AS average
      FROM (
        SELECT COUNT(*) AS total
        FROM public.nominations n
        WHERE n.game_id IN (
          SELECT game_id
          FROM public.nominations
          WHERE winner = true AND nomination_type = 'gotm' AND game_id IS NOT NULL
        )
        GROUP BY n.game_id
      ) sub;
    `;

    const result = await this.databaseService.query(sql);
    return Number(result.rows[0]?.average ?? 0);
  }

  async findTopNominationWinsByUser(): Promise<UserWinStat[]> {
    const sql = `
      SELECT
        u.name,
        COUNT(*)::int AS wins
      FROM public.nominations n
      INNER JOIN public.users u ON n.user_id = u.id
      WHERE n.nomination_type = 'gotm'
        AND n.winner = true
        AND n.user_id > 1
      GROUP BY u.id, u.name
      ORDER BY wins DESC, u.name ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      name: row.name,
      wins: Number(row.wins ?? 0),
    }));
  }

  async findMostNominatedGames(
    losersOnly = false,
  ): Promise<GameNominationCountStat[]> {
    const loserFilter = losersOnly
      ? `AND n.game_id NOT IN (
          SELECT game_id
          FROM public.nominations
          WHERE winner = true AND nomination_type = 'gotm' AND game_id IS NOT NULL
        )`
      : '';

    const sql = `
      SELECT
        ${COALESCED_TITLE} AS title,
        COUNT(*)::int AS total
      FROM public.nominations n
      INNER JOIN public.games g ON n.game_id = g.id
      WHERE n.nomination_type = 'gotm'
        ${loserFilter}
      GROUP BY g.id
      ORDER BY total DESC, title ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      total: Number(row.total ?? 0),
    }));
  }

  async findTimeToBeatByMonth(
    mode: 'avg' | 'total' | 'longest' | 'shortest',
  ): Promise<ThemeTimeToBeatStat[]> {
    const agg =
      mode === 'avg'
        ? 'AVG(g.time_to_beat)::float'
        : 'SUM(g.time_to_beat)::float';
    let orderBy = 't.creation_date DESC';
    if (mode === 'longest') orderBy = 'value DESC NULLS LAST';
    if (mode === 'shortest') orderBy = 'value ASC NULLS LAST';

    const sql = `
      SELECT
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') || ' - ' || t.title AS theme,
        ${agg} AS value
      FROM public.games g
      INNER JOIN public.nominations n ON g.id = n.game_id
      INNER JOIN public.themes t ON t.id = n.theme_id
      WHERE n.winner = true
        AND n.nomination_type = 'gotm'
      GROUP BY t.id, t.creation_date, t.title
      ORDER BY ${orderBy};
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      theme: row.theme,
      value:
        row.value !== null && row.value !== undefined
          ? Number(row.value)
          : undefined,
    }));
  }

  async findMostNominatedGamesByUser(): Promise<UserNominationCountStat[]> {
    const sql = `
      SELECT
        u.name,
        COUNT(*)::int AS nominations
      FROM public.nominations n
      INNER JOIN public.users u ON n.user_id = u.id
      WHERE n.game_id IN (
        SELECT game_id
        FROM public.nominations
        WHERE nomination_type = 'gotm' AND game_id IS NOT NULL
      )
      AND n.user_id > 1
      GROUP BY u.id, u.name
      ORDER BY nominations DESC, u.name ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      name: row.name,
      nominations: Number(row.nominations ?? 0),
    }));
  }

  async findCompletionsCountByGame(): Promise<GameNominationCompletionStat[]> {
    const sql = `
      SELECT
        ${COALESCED_TITLE} AS title,
        COUNT(*)::int AS completions,
        n.theme_id,
        n.nomination_type
      FROM public.completions c
      INNER JOIN public.nominations n ON n.id = c.nomination_id
      INNER JOIN public.games g ON n.game_id = g.id
      GROUP BY n.id, g.id, n.theme_id, n.nomination_type
      ORDER BY n.theme_id DESC NULLS LAST, completions DESC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      completions: Number(row.completions ?? 0),
      themeId: toOptionalInt(row.theme_id),
      nominationType: row.nomination_type,
    }));
  }

  async findNominationSuccessPercentByUser(): Promise<
    UserNominationSuccessStat[]
  > {
    const sql = `
      WITH aggregated AS (
        SELECT
          u.id,
          u.name,
          COALESCE(u.earned_points, 0)::float AS earned_points,
          COALESCE(
            FLOOR(
              100.0 * SUM(CASE WHEN n.winner THEN 1 ELSE 0 END) / NULLIF(COUNT(n.id), 0)
            ),
            0
          )::int AS success_rate,
          COUNT(n.id)::int AS nominations,
          COALESCE(SUM(CASE WHEN n.winner THEN 1 ELSE 0 END), 0)::int AS wins
        FROM public.users u
        LEFT JOIN public.nominations n
          ON u.id = n.user_id
          AND n.nomination_type = 'gotm'
        WHERE u.id > 1
        GROUP BY u.id, u.name, u.earned_points
      )
      SELECT
        RANK() OVER (ORDER BY earned_points DESC)::int AS rank,
        *
      FROM aggregated
      ORDER BY earned_points DESC, name ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      rank: Number(row.rank),
      id: Number(row.id),
      name: row.name,
      earnedPoints: Number(row.earned_points ?? 0),
      successRate: Number(row.success_rate ?? 0),
      nominations: Number(row.nominations ?? 0),
      wins: Number(row.wins ?? 0),
    }));
  }

  async findNominationCountByThemeByCategory(): Promise<
    ThemeCategoryCountStat[]
  > {
    const sql = `
      SELECT
        t.title,
        CASE
          WHEN g.year !~ '^\\d+$' THEN 'Unknown'
          WHEN g.year::int < 1996 THEN 'pre-96'
          WHEN g.year::int BETWEEN 1996 AND 1999 THEN '96-99'
          WHEN g.year::int >= 2000 THEN '2k+'
          ELSE 'Unknown'
        END AS category,
        COUNT(*)::int AS count
      FROM public.themes t
      INNER JOIN public.nominations n ON t.id = n.theme_id
      INNER JOIN public.games g ON n.game_id = g.id
      WHERE t.nomination_type = 'gotm'
      GROUP BY t.id, t.title, category
      ORDER BY t.creation_date DESC, category ASC;
    `;

    const result = await this.databaseService.query(sql);
    return result.rows.map((row) => ({
      title: row.title,
      category: row.category,
      count: Number(row.count ?? 0),
    }));
  }
}
