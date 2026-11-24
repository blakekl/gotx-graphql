import { Resolver, Query } from '@nestjs/graphql';
import { DatabaseService } from './database/database.service.js';

@Resolver()
export class AppResolver {
  constructor(private readonly databaseService: DatabaseService) {}

  @Query(() => String)
  async healthCheck(): Promise<string> {
    return (await this.databaseService.ready()) ? 'ok' : 'unavailable';
  }
}
