import { Args, Float, Query, Resolver } from '@nestjs/graphql';
import { NominationTypePipe } from '../validation/query-arguments.js';
import {
  GameCompletionStat,
  GameNominationCompletionStat,
  GameNominationCountStat,
  ThemeCategoryCountStat,
  ThemeTimeToBeatStat,
  UserNominationCountStat,
  UserNominationSuccessStat,
  UserWinStat,
} from './dto/stats.models.js';
import { StatsService } from './stats.service.js';

@Resolver()
export class StatsResolver {
  constructor(private readonly statsService: StatsService) {}

  @Query(() => [GameCompletionStat], { name: 'mostCompletedGames' })
  async getMostCompletedGames(
    @Args(
      'nominationType',
      { type: () => String, nullable: true },
      NominationTypePipe,
    )
    nominationType?: string,
  ): Promise<GameCompletionStat[]> {
    return this.statsService.findMostCompletedGames(nominationType);
  }

  @Query(() => [GameCompletionStat], { name: 'newestCompletions' })
  async getNewestCompletions(
    @Args(
      'nominationType',
      { type: () => String, nullable: true },
      NominationTypePipe,
    )
    nominationType?: string,
  ): Promise<GameCompletionStat[]> {
    return this.statsService.findNewestCompletions(nominationType);
  }

  @Query(() => [GameNominationCountStat], { name: 'totalNomsBeforeWinByGame' })
  async getTotalNomsBeforeWinByGame(): Promise<GameNominationCountStat[]> {
    return this.statsService.findTotalNomsBeforeWinByGame();
  }

  @Query(() => Float, { name: 'avgNominationsBeforeWin' })
  async getAvgNominationsBeforeWin(): Promise<number> {
    return this.statsService.findAvgNominationsBeforeWin();
  }

  @Query(() => [UserWinStat], { name: 'topNominationWinsByUser' })
  async getTopNominationWinsByUser(): Promise<UserWinStat[]> {
    return this.statsService.findTopNominationWinsByUser();
  }

  @Query(() => [GameNominationCountStat], { name: 'mostNominatedGames' })
  async getMostNominatedGames(
    @Args('losersOnly', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    losersOnly?: boolean,
  ): Promise<GameNominationCountStat[]> {
    return this.statsService.findMostNominatedGames(losersOnly);
  }

  @Query(() => [ThemeTimeToBeatStat], { name: 'avgTimeToBeatByMonth' })
  async getAvgTimeToBeatByMonth(): Promise<ThemeTimeToBeatStat[]> {
    return this.statsService.findTimeToBeatByMonth('avg');
  }

  @Query(() => [ThemeTimeToBeatStat], { name: 'totalTimeToBeatByMonth' })
  async getTotalTimeToBeatByMonth(): Promise<ThemeTimeToBeatStat[]> {
    return this.statsService.findTimeToBeatByMonth('total');
  }

  @Query(() => [ThemeTimeToBeatStat], { name: 'longestMonthsByAvgTimeToBeat' })
  async getLongestMonthsByAvgTimeToBeat(): Promise<ThemeTimeToBeatStat[]> {
    return this.statsService.findTimeToBeatByMonth('longest');
  }

  @Query(() => [ThemeTimeToBeatStat], { name: 'shortestMonthsByAvgTimeToBeat' })
  async getShortestMonthsByAvgTimeToBeat(): Promise<ThemeTimeToBeatStat[]> {
    return this.statsService.findTimeToBeatByMonth('shortest');
  }

  @Query(() => [UserNominationCountStat], { name: 'mostNominatedGamesByUser' })
  async getMostNominatedGamesByUser(): Promise<UserNominationCountStat[]> {
    return this.statsService.findMostNominatedGamesByUser();
  }

  @Query(() => [GameNominationCompletionStat], {
    name: 'completionsCountByGame',
  })
  async getCompletionsCountByGame(): Promise<GameNominationCompletionStat[]> {
    return this.statsService.findCompletionsCountByGame();
  }

  @Query(() => [UserNominationSuccessStat], {
    name: 'nominationSuccessPercentByUser',
  })
  async getNominationSuccessPercentByUser(): Promise<
    UserNominationSuccessStat[]
  > {
    return this.statsService.findNominationSuccessPercentByUser();
  }

  @Query(() => [ThemeCategoryCountStat], {
    name: 'nominationCountByThemeByCategory',
  })
  async getNominationCountByThemeByCategory(): Promise<
    ThemeCategoryCountStat[]
  > {
    return this.statsService.findNominationCountByThemeByCategory();
  }
}
