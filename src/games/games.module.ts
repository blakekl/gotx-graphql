import { Module } from '@nestjs/common';
import { GamesResolver } from './games.resolver.js';
import { GamesService } from './games.service.js';

@Module({
  providers: [GamesService, GamesResolver],
  exports: [GamesService],
})
export class GamesModule {}
