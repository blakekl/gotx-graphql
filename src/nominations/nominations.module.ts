import { Module } from '@nestjs/common';
import { NominationsResolver } from './nominations.resolver.js';
import { NominationsService } from './nominations.service.js';

@Module({
  providers: [NominationsService, NominationsResolver],
  exports: [NominationsService],
})
export class NominationsModule {}
