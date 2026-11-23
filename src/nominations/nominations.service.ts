import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PUBLICATION_CTES } from '../database/publication.sql.js';
import { Nomination } from './dto/nomination.model.js';
import { NominationDetail } from './dto/nomination-detail.model.js';

interface NominationRow {
  id: number | string;
  nomination_type: string;
  description: string | null;
  winner: boolean;
  game_id: number | string | null;
  user_id: number | string | null;
  theme_id: number | string | null;
}

interface NominationDetailRow {
  title: string | null;
  nomination_type: string;
  game_id: number | string | null;
  user_name: string | null;
  game_description: string | null;
  theme_title: string | null;
  theme_description: string | null;
  date: string | null;
  winner: boolean | null;
}

const toOptionalInt = (val: number | string | null): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Injectable()
export class NominationsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(nominationType?: string): Promise<Nomination[]> {
    const hasType = Boolean(nominationType);
    const sql = hasType
      ? `
          WITH ${PUBLICATION_CTES}
          SELECT id, nomination_type, description, winner, game_id, user_id, theme_id
          FROM published_nominations
          WHERE nomination_type = $1
          ORDER BY id ASC;
        `
      : `
          WITH ${PUBLICATION_CTES}
          SELECT id, nomination_type, description, winner, game_id, user_id, theme_id
          FROM published_nominations
          ORDER BY id ASC;
        `;

    const result = hasType
      ? await this.databaseService.query(sql, [nominationType])
      : await this.databaseService.query(sql);

    return (result.rows as NominationRow[]).map((row) => ({
      id: Number(row.id),
      nominationType: row.nomination_type,
      description: row.description ?? undefined,
      winner: Boolean(row.winner),
      gameId: toOptionalInt(row.game_id),
      userId: toOptionalInt(row.user_id),
      themeId: toOptionalInt(row.theme_id),
    }));
  }

  private async queryNominationDetails(
    whereClause = '',
    params: unknown[] = [],
  ): Promise<NominationDetail[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        CASE WHEN g.id IS NOT NULL THEN COALESCE(
          g.title_world,
          g.title_usa,
          g.title_eu,
          g.title_jp,
          g.title_other,
          'Untitled'
        ) END AS title,
        n.nomination_type,
        n.game_id,
        u.name AS user_name,
        n.description AS game_description,
        t.title AS theme_title,
        t.description AS theme_description,
        TO_CHAR(t.creation_date, 'YYYY-MM-DD') AS date,
        n.winner
      FROM published_nominations n
      LEFT JOIN public.games g ON g.id = n.game_id
      LEFT JOIN public.users u ON u.id = n.user_id
      LEFT JOIN published_themes t ON t.id = n.theme_id
      ${whereClause}
      ORDER BY t.creation_date DESC NULLS LAST, n.id DESC;
    `;

    const result = await this.databaseService.query(sql, params);

    return (result.rows as NominationDetailRow[]).map((row) => ({
      title: row.title ?? undefined,
      nominationType: row.nomination_type,
      gameId: toOptionalInt(row.game_id),
      userName: row.user_name ?? undefined,
      gameDescription: row.game_description ?? undefined,
      themeTitle: row.theme_title ?? undefined,
      themeDescription: row.theme_description ?? undefined,
      date: row.date ?? undefined,
      winner: Boolean(row.winner),
    }));
  }

  async findNominationData(): Promise<NominationDetail[]> {
    return this.queryNominationDetails();
  }

  async findNominationDataByGameId(
    gameId: number,
  ): Promise<NominationDetail[]> {
    return this.queryNominationDetails('WHERE n.game_id = $1', [gameId]);
  }

  async findNominationDataByUserId(
    userId: number,
  ): Promise<NominationDetail[]> {
    return this.queryNominationDetails('WHERE n.user_id = $1', [userId]);
  }
}
