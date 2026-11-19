import { Resolver, Query } from '@nestjs/graphql';
import { DatabaseService } from './database/database.service.js';

@Resolver()
export class AppResolver {
  constructor(private readonly databaseService: DatabaseService) {}

  @Query(() => String)
  async healthCheck(): Promise<string> {
    const result = await this.databaseService.query('SELECT NOW()');
    return `Database connected successfully! Server time: ${result.rows[0].now}`;
  }
}
