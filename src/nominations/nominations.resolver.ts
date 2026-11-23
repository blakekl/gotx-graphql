import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import {
  NominationTypePipe,
  PositiveIntPipe,
} from '../validation/query-arguments.js';
import { Nomination } from './dto/nomination.model.js';
import { NominationDetail } from './dto/nomination-detail.model.js';
import { NominationsService } from './nominations.service.js';

@Resolver(() => Nomination)
export class NominationsResolver {
  constructor(private readonly nominationsService: NominationsService) {}

  @Query(() => [Nomination], { name: 'nominations' })
  async getNominations(
    @Args(
      'nominationType',
      { type: () => String, nullable: true },
      NominationTypePipe,
    )
    nominationType?: string,
  ): Promise<Nomination[]> {
    return this.nominationsService.findAll(nominationType);
  }

  @Query(() => [NominationDetail], { name: 'nominationData' })
  async getNominationData(): Promise<NominationDetail[]> {
    return this.nominationsService.findNominationData();
  }

  @Query(() => [NominationDetail], { name: 'nominationDataByGameId' })
  async getNominationDataByGameId(
    @Args('gameId', { type: () => Int }, PositiveIntPipe) gameId: number,
  ): Promise<NominationDetail[]> {
    return this.nominationsService.findNominationDataByGameId(gameId);
  }

  @Query(() => [NominationDetail], { name: 'nominationDataByUserId' })
  async getNominationDataByUserId(
    @Args('userId', { type: () => Int }, PositiveIntPipe) userId: number,
  ): Promise<NominationDetail[]> {
    return this.nominationsService.findNominationDataByUserId(userId);
  }
}
