import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { databaseConfiguration } from './configuration.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;
  private closing?: Promise<void>;
  private stopping = false;
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool(databaseConfiguration(this.configService));
    this.pool.on('error', () =>
      this.logger.warn('Database connection unavailable'),
    );
  }

  onModuleDestroy() {
    this.stopAdmission();
    return (this.closing ??= this.pool?.end() ?? Promise.resolve());
  }

  stopAdmission() {
    this.stopping = true;
  }

  async ready(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return !this.stopping;
    } catch {
      return false;
    }
  }

  // A clean query helper method to execute raw SQL statements against your container
  async query(text: string, params?: any[]) {
    if (this.stopping || !this.pool) throw new Error('Database unavailable');
    return this.pool.query(text, params);
  }
}
