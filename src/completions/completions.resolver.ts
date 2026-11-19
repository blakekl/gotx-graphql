import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Completion } from './dto/completion.model.js';
import { CompletionsService } from './completions.service.js';

@Resolver(() => Completion)
export class CompletionsResolver {
  constructor(private readonly completionsService: CompletionsService) {}

  @Query(() => [Completion], { name: 'completionsByUserId' })
  async getCompletionsByUserId(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<Completion[]> {
    return this.completionsService.findByUserId(userId);
  }
}
