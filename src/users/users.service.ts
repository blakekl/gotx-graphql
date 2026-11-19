import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { User } from './dto/user.model.js';

interface UserRow {
  id: number | string;
  name: string;
  discord_id: number | string | null;
  earned_points: number | null;
  current_points: number | null;
  redeemed_points: number | null;
  premium_points: number | null;
  admin: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(id: number): Promise<User | null> {
    const sql = `
      SELECT *
      FROM public.users
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await this.databaseService.query(sql, [id]);
    const row = result.rows[0] as UserRow | undefined;

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      name: row.name,
      discordId:
        row.discord_id !== null && row.discord_id !== undefined
          ? String(row.discord_id)
          : undefined,
      earnedPoints: row.earned_points ?? undefined,
      currentPoints: row.current_points ?? undefined,
      redeemedPoints: row.redeemed_points ?? undefined,
      premiumPoints: row.premium_points ?? undefined,
      admin: Boolean(row.admin),
    };
  }
}
