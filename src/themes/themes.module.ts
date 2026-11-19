import { Module } from '@nestjs/common';
import { ThemesResolver } from './themes.resolver.js';
import { ThemesService } from './themes.service.js';

@Module({
  providers: [ThemesService, ThemesResolver],
  exports: [ThemesService],
})
export class ThemesModule {}
