import { Module } from '@nestjs/common';
import { CompletionsResolver } from './completions.resolver.js';
import { CompletionsService } from './completions.service.js';

@Module({
  providers: [CompletionsService, CompletionsResolver],
  exports: [CompletionsService],
})
export class CompletionsModule {}
