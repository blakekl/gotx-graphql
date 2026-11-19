import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { CurrentWinner } from './dto/current-winner.model.js';
import {
  GotyThemeDetail,
  GotyThemeYearSummary,
} from './dto/goty-theme.model.js';
import { ThemeDetailEntry } from './dto/theme-detail.model.js';
import { ThemeWithStatus } from './dto/theme-status.model.js';
import { ThemeWinner } from './dto/theme-winner.model.js';
import { ThemesService } from './themes.service.js';

@Resolver()
export class ThemesResolver {
  constructor(private readonly themesService: ThemesService) {}

  @Query(() => [ThemeWithStatus], { name: 'themesWithStatus' })
  async getThemesWithStatus(): Promise<ThemeWithStatus[]> {
    return this.themesService.findThemesWithStatus();
  }

  @Query(() => [CurrentWinner], { name: 'currentWinners' })
  async getCurrentWinners(): Promise<CurrentWinner[]> {
    return this.themesService.findCurrentWinners();
  }

  @Query(() => [ThemeDetailEntry], { name: 'themeDetailWithCategories' })
  async getThemeDetailWithCategories(
    @Args('themeId', { type: () => Int }) themeId: number,
  ): Promise<ThemeDetailEntry[]> {
    return this.themesService.findThemeDetailWithCategories(themeId);
  }

  @Query(() => [ThemeWinner], { name: 'themeWinners' })
  async getThemeWinners(
    @Args('themeId', { type: () => Int }) themeId: number,
  ): Promise<ThemeWinner[]> {
    return this.themesService.findThemeWinners(themeId);
  }

  @Query(() => [GotyThemeYearSummary], { name: 'gotyThemesByYear' })
  async getGotyThemesByYear(): Promise<GotyThemeYearSummary[]> {
    return this.themesService.findGotyThemesByYear();
  }

  @Query(() => [GotyThemeDetail], { name: 'gotyThemesForYear' })
  async getGotyThemesForYear(
    @Args('creationDate', { type: () => String }) creationDate: string,
  ): Promise<GotyThemeDetail[]> {
    return this.themesService.findGotyThemesForYear(creationDate);
  }
}
