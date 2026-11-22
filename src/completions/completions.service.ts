import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { PUBLICATION_CTES } from '../database/publication.sql.js';
import { Completion } from './dto/completion.model.js';

interface CompletionRow {
  id: number | string;
  title: string | null;
  title_world: string | null;
  title_usa: string | null;
  title_eu: string | null;
  title_jp: string | null;
  title_other: string | null;
  date: string;
  nomination_type: string;
  theme_id: number | string | null;
  rpg_achievements: boolean | null;
}

const toOptionalInt = (val: number | string | null): number | undefined => {
  if (val === null || val === undefined) return undefined;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isNaN(parsed) ? undefined : parsed;
};

@Injectable()
export class CompletionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByUserId(userId: number): Promise<Completion[]> {
    const sql = `
      WITH ${PUBLICATION_CTES}
      SELECT
        c.id,
        COALESCE(
          g.title_world,
          g.title_usa,
          g.title_eu,
          g.title_jp,
          g.title_other,
          'Untitled'
        ) AS title,
        g.title_world,
        g.title_usa,
        g.title_eu,
        g.title_jp,
        g.title_other,
        TO_CHAR(c.completed_at, 'YYYY-MM-DD') AS date,
        n.nomination_type,
        n.theme_id,
        c.rpg_achievements
      FROM public.completions c
      INNER JOIN public.users u ON u.id = c.user_id
      INNER JOIN published_nominations n ON n.id = c.nomination_id
      INNER JOIN public.games g ON g.id = n.game_id
      WHERE c.user_id = $1
      ORDER BY c.completed_at DESC;
    `;

    const result = await this.databaseService.query(sql, [userId]);

    return (result.rows as CompletionRow[]).map((row) => ({
      id: Number(row.id),
      title: row.title ?? 'Untitled',
      titleWorld: row.title_world ?? undefined,
      titleUsa: row.title_usa ?? undefined,
      titleEu: row.title_eu ?? undefined,
      titleJp: row.title_jp ?? undefined,
      titleOther: row.title_other ?? undefined,
      date: row.date,
      nominationType: row.nomination_type,
      themeId: toOptionalInt(row.theme_id),
      rpgAchievements: Boolean(row.rpg_achievements),
    }));
  }
}
