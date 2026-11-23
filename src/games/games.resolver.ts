import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import {
  NominationTypePipe,
  PositiveIntPipe,
} from '../validation/query-arguments.js';
import { Game } from './dto/game.model.js';
import { GamesService } from './games.service.js';

@Resolver(() => Game)
export class GamesResolver {
  constructor(private readonly gamesService: GamesService) {}

  @Query(() => Game, { nullable: true, name: 'game' })
  async getGameById(
    @Args('id', { type: () => Int }, PositiveIntPipe) id: number,
  ): Promise<Game | null> {
    return this.gamesService.findById(id);
  }

  @Query(() => [Game], { name: 'gamesByNomination' })
  async getGamesByNomination(
    @Args('nominationType', { type: () => String }, NominationTypePipe)
    nominationType: string,
    @Args('winner', { type: () => Boolean, nullable: true }) winner?: boolean,
  ): Promise<Game[]> {
    return this.gamesService.findByNomination(nominationType, winner);
  }
}
