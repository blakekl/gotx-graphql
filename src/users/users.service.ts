import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { User } from './dto/user.model.js';

interface UserRow {
  id: number | string;
  name: string;
  earned_points: number | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findById(id: number): Promise<User | null> {
    const sql = `
      SELECT id, name, earned_points
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
      earnedPoints: row.earned_points ?? undefined,
    };
  }
}
