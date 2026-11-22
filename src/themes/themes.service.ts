import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PUBLICATION_CTES } from '../database/publication.sql.js';
import { CurrentWinner } from './dto/current-winner.model.js';
import {
  GotyThemeDetail,
  GotyThemeYearSummary,
} from './dto/goty-theme.model.js';
import { ThemeDetailEntry } from './dto/theme-detail.model.js';
import { ThemeWithStatus } from './dto/theme-status.model.js';
import { ThemeWinner } from './dto/theme-winner.model.js';

const toOptionalInt = (
  val: number | string | null | undefined,
): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const YEAR_CATEGORY_SQL = `
  CASE
    WHEN g.year !~ '^\\d+$' THEN 'Unknown'
    WHEN t.id < 235 AND g.year::int < 1996 THEN 'pre 96'
    WHEN t.id < 235 AND g.year::int BETWEEN 1996 AND 1999 THEN '96-99'
    WHEN t.id < 235 AND g.year::int >= 2000 THEN '2k+'
    WHEN t.id >= 235 AND g.year::int < 1996 THEN 'pre 96'
    WHEN t.id >= 235 AND g.year::int BETWEEN 1996 AND 2001 THEN '96-01'
    WHEN t.id >= 235 AND g.year::int >= 2002 THEN '02+'
    ELSE 'Unknown'
  END
`;

@Injectable()
export class ThemesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findThemesWithStatus(): Promise<ThemeWithStatus[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        t.id,
        t.nomination_type,
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS creation_date,
        t.description,
        'completed' AS status,
        t.title AS display_title,
        COUNT(n.id)::int AS nomination_count,
        COUNT(CASE WHEN n.winner = true THEN 1 END)::int AS winner_count
      FROM published_themes t
      LEFT JOIN published_nominations n ON t.id = n.theme_id
      GROUP BY t.id, t.title, t.nomination_type, t.creation_date, t.description
      ORDER BY t.creation_date DESC, t.nomination_type;
    `;

    const result = await this.databaseService.query(sql);

    return result.rows.map((row) => ({
      id: Number(row.id),
      nominationType: row.nomination_type ?? undefined,
      creationDate: row.creation_date,
      description: row.description ?? undefined,
      status: row.status,
      displayTitle: row.display_title ?? undefined,
      nominationCount: Number(row.nomination_count ?? 0),
      winnerCount: Number(row.winner_count ?? 0),
    }));
  }

  async findCurrentWinners(): Promise<CurrentWinner[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        n.nomination_type,
        t.title AS theme_title,
        t.id AS theme_id,
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS creation_date,
        t.description AS theme_description,
        g.id AS game_id,
        COALESCE(g.title_world, g.title_usa, g.title_eu, g.title_jp, g.title_other, 'Untitled') AS title,
        g.screenscraper_id,
        g.year,
        g.systems,
        g.developer,
        g.genres,
        g.img_url,
        g.time_to_beat,
        'Unknown' AS year_category,
        (SELECT COUNT(*)::int FROM published_nominations n3 WHERE n3.theme_id = t.id) AS nomination_count
      FROM published_nominations n
      INNER JOIN public.games g ON g.id = n.game_id
      INNER JOIN published_themes t ON t.id = n.theme_id
      WHERE n.winner = true
        AND t.id IN (
          SELECT t2.id
          FROM published_themes t2
          INNER JOIN published_nominations n2 ON t2.id = n2.theme_id AND n2.winner = true
          WHERE t2.nomination_type = t.nomination_type
          ORDER BY t2.creation_date DESC, t2.id DESC
          LIMIT 1
        )
      ORDER BY t.creation_date DESC, n.nomination_type;
    `;

    const result = await this.databaseService.query(sql);

    return result.rows.map((row) => ({
      nominationType: row.nomination_type,
      themeTitle: row.theme_title,
      themeId: Number(row.theme_id),
      creationDate: row.creation_date,
      themeDescription: row.theme_description ?? undefined,
      gameId: Number(row.game_id),
      title: row.title ?? 'Untitled',
      screenscraperId: toOptionalInt(row.screenscraper_id),
      year: row.year ?? undefined,
      systems: row.systems ?? undefined,
      developer: row.developer ?? undefined,
      genres: row.genres ?? undefined,
      imgUrl: row.img_url ?? undefined,
      timeToBeat: row.time_to_beat ?? undefined,
      yearCategory: row.year_category,
      nominationCount: Number(row.nomination_count ?? 0),
    }));
  }

  async findThemeDetailWithCategories(
    themeId: number,
  ): Promise<ThemeDetailEntry[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        t.id,
        t.title,
        t.nomination_type,
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS creation_date,
        t.description,
        COALESCE(g.title_world, g.title_usa, g.title_eu, g.title_jp, g.title_other, 'Untitled') AS game_title,
        g.title_world,
        g.title_usa,
        g.title_eu,
        g.title_jp,
        g.title_other,
        g.id AS game_id,
        g.year,
        g.screenscraper_id,
        g.systems,
        g.developer,
        g.genres,
        g.img_url,
        g.time_to_beat,
        n.winner,
        n.description AS nomination_description,
        u.name AS user_name,
        ${YEAR_CATEGORY_SQL} AS year_category
      FROM published_themes t
      INNER JOIN published_nominations n ON t.id = n.theme_id
      INNER JOIN public.games g ON n.game_id = g.id
      LEFT JOIN public.users u ON n.user_id = u.id
      WHERE t.id = $1
      ORDER BY n.winner DESC, g.year ASC;
    `;

    const result = await this.databaseService.query(sql, [themeId]);

    return result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title ?? undefined,
      nominationType: row.nomination_type ?? undefined,
      creationDate: row.creation_date,
      description: row.description ?? undefined,
      gameTitle: row.game_title ?? 'Untitled',
      titleWorld: row.title_world ?? undefined,
      titleUsa: row.title_usa ?? undefined,
      titleEu: row.title_eu ?? undefined,
      titleJp: row.title_jp ?? undefined,
      titleOther: row.title_other ?? undefined,
      gameId: Number(row.game_id),
      year: row.year ?? undefined,
      screenscraperId: toOptionalInt(row.screenscraper_id),
      systems: row.systems ?? undefined,
      developer: row.developer ?? undefined,
      genres: row.genres ?? undefined,
      imgUrl: row.img_url ?? undefined,
      timeToBeat: row.time_to_beat ?? undefined,
      winner: Boolean(row.winner),
      nominationDescription: row.nomination_description ?? undefined,
      userName: row.user_name ?? undefined,
      yearCategory: row.year_category,
    }));
  }

  async findThemeWinners(themeId: number): Promise<ThemeWinner[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        COALESCE(g.title_world, g.title_usa, g.title_eu, g.title_jp, g.title_other, 'Untitled') AS title,
        g.id AS game_id,
        g.year,
        g.screenscraper_id,
        g.systems,
        g.developer,
        g.genres,
        g.img_url,
        g.time_to_beat,
        n.description AS nomination_description,
        u.name AS user_name,
        ${YEAR_CATEGORY_SQL} AS year_category
      FROM published_nominations n
      INNER JOIN public.games g ON n.game_id = g.id
      INNER JOIN published_themes t ON n.theme_id = t.id
      LEFT JOIN public.users u ON n.user_id = u.id
      WHERE n.theme_id = $1
        AND n.winner = true
      ORDER BY year_category, g.year ASC;
    `;

    const result = await this.databaseService.query(sql, [themeId]);

    return result.rows.map((row) => ({
      title: row.title ?? 'Untitled',
      gameId: Number(row.game_id),
      year: row.year ?? undefined,
      screenscraperId: toOptionalInt(row.screenscraper_id),
      systems: row.systems ?? undefined,
      developer: row.developer ?? undefined,
      genres: row.genres ?? undefined,
      imgUrl: row.img_url ?? undefined,
      timeToBeat: row.time_to_beat ?? undefined,
      nominationDescription: row.nomination_description ?? undefined,
      userName: row.user_name ?? undefined,
      yearCategory: row.year_category,
    }));
  }

  async findGotyThemesByYear(): Promise<GotyThemeYearSummary[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS creation_date,
        EXTRACT(YEAR FROM t.creation_date)::int AS year,
        COUNT(DISTINCT t.id)::int AS theme_count,
        COUNT(CASE WHEN n.winner = true THEN 1 END)::int AS total_winners,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.title), NULL) AS category_titles
      FROM published_themes t
      LEFT JOIN published_nominations n ON t.id = n.theme_id
      WHERE t.nomination_type = 'goty'
      GROUP BY t.creation_date
      ORDER BY t.creation_date DESC;
    `;

    const result = await this.databaseService.query(sql);

    return result.rows.map((row) => ({
      creationDate: row.creation_date,
      year: Number(row.year),
      themeCount: Number(row.theme_count ?? 0),
      totalWinners: Number(row.total_winners ?? 0),
      categoryTitles: row.category_titles ?? [],
    }));
  }

  async findGotyThemesForYear(
    creationDate: string,
  ): Promise<GotyThemeDetail[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        t.id,
        t.title,
        t.description,
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS creation_date,
        COUNT(n.id)::int AS nomination_count,
        COUNT(CASE WHEN n.winner = true THEN 1 END)::int AS winner_count,
        MAX(COALESCE(g.title_world, g.title_usa, g.title_eu, g.title_jp, g.title_other)) AS winner_title,
        g.id AS winner_game_id,
        g.screenscraper_id AS winner_screenscraper_id
      FROM published_themes t
      LEFT JOIN published_nominations n ON t.id = n.theme_id
      LEFT JOIN public.games g ON n.game_id = g.id AND n.winner = true
      WHERE t.nomination_type = 'goty'
        AND t.creation_date = $1::date
      GROUP BY t.id, t.title, t.description, t.creation_date, g.id, g.screenscraper_id
      ORDER BY t.title;
    `;

    const result = await this.databaseService.query(sql, [creationDate]);

    return result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      description: row.description ?? undefined,
      creationDate: row.creation_date,
      nominationCount: Number(row.nomination_count ?? 0),
      winnerCount: Number(row.winner_count ?? 0),
      winnerTitle: row.winner_title ?? undefined,
      winnerGameId: toOptionalInt(row.winner_game_id),
      winnerScreenscraperId: toOptionalInt(row.winner_screenscraper_id),
    }));
  }
}
