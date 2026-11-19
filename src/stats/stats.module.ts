import { Module } from '@nestjs/common';
import { StatsResolver } from './stats.resolver.js';
import { StatsService } from './stats.service.js';

@Module({
  providers: [StatsService, StatsResolver],
  exports: [StatsService],
})
export class StatsModule {}
