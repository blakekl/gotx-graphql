import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PUBLICATION_CTES } from '../database/publication.sql.js';
import { Game } from './dto/game.model.js';

interface GameRow {
  id: number | string;
  title: string | null;
  title_world: string | null;
  title_usa: string | null;
  title_eu: string | null;
  title_jp: string | null;
  title_other: string | null;
  year: string | null;
  systems: string[] | null;
  developer: string | null;
  genres: string[] | null;
  img_url: string | null;
  time_to_beat: number | null;
  screenscraper_id: string | null;
  igdb_id: string | null;
}

@Injectable()
export class GamesService {
  constructor(private readonly databaseService: DatabaseService) {}

  private mapRowToGame(row: GameRow): Game {
    return {
      id: Number(row.id),
      title: row.title ?? 'Untitled',
      titleWorld: row.title_world ?? undefined,
      titleUsa: row.title_usa ?? undefined,
      titleEu: row.title_eu ?? undefined,
      titleJp: row.title_jp ?? undefined,
      titleOther: row.title_other ?? undefined,
      year: row.year ?? undefined,
      systems: row.systems ?? undefined,
      developer: row.developer ?? undefined,
      genres: row.genres ?? undefined,
      imgUrl: row.img_url ?? undefined,
      timeToBeat: row.time_to_beat ?? undefined,
      screenscraperId: row.screenscraper_id,
      igdbId: row.igdb_id,
    };
  }

  async findById(id: number): Promise<Game | null> {
    const sql = `
      SELECT
        *,
        COALESCE(
          title_world,
          title_usa,
          title_eu,
          title_jp,
          title_other,
          'Untitled'
        ) AS title
      FROM public.games
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await this.databaseService.query(sql, [id]);
    const row = result.rows[0] as GameRow | undefined;

    return row ? this.mapRowToGame(row) : null;
  }

  async findByNomination(
    nominationType: string,
    winner?: boolean,
  ): Promise<Game[]> {
    let filterClause = '';

    if (winner === true) {
      filterClause = `
        WHERE id IN (
          SELECT game_id
          FROM published_nominations
          WHERE nomination_type = $1 AND winner = true AND game_id IS NOT NULL
        )
      `;
    } else if (winner === false) {
      filterClause = `
        WHERE id IN (
          SELECT game_id
          FROM published_nominations
          WHERE nomination_type = $1 AND game_id IS NOT NULL
        )
        AND id NOT IN (
          SELECT game_id
          FROM published_nominations
          WHERE nomination_type = $1 AND winner = true AND game_id IS NOT NULL
        )
      `;
    } else {
      filterClause = `
        WHERE id IN (
          SELECT game_id
          FROM published_nominations
          WHERE nomination_type = $1 AND game_id IS NOT NULL
        )
      `;
    }

    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        *,
        COALESCE(
          title_world,
          title_usa,
          title_eu,
          title_jp,
          title_other,
          'Untitled'
        ) AS title
      FROM public.games
      ${filterClause}
      ORDER BY title ASC;
    `;

    const result = await this.databaseService.query(sql, [nominationType]);
    return (result.rows as GameRow[]).map((row) => this.mapRowToGame(row));
  }
}
