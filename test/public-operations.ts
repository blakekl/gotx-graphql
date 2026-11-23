// Executable consumer examples: no client library, schema decorators or legacy
// SQLite DTOs. The supplied transport must reject GraphQL errors before returning
// data. These response shapes describe selected fields, not whole API objects.
export type Send = <T>(
  query: string,
  variables: Record<string, string | number>,
) => Promise<T>;

export interface ThemeView {
  themeYearCategories: {
    key: string;
    label: string;
    minYear: number | null;
    maxYear: number | null;
  }[];
  themeDetailWithCategories: {
    gameId: number;
    gameTitle: string;
    year: string | null;
    yearCategory: string;
    screenscraperId: string | null;
  }[];
  nominationCountByThemeByCategory: {
    themeId: number;
    category: string;
    count: number;
  }[];
}

export function loadTheme(send: Send, themeId: number): Promise<ThemeView> {
  return send<ThemeView>(
    `query Theme($themeId: Int!) {
    themeYearCategories(themeId: $themeId) { key label minYear maxYear }
    themeDetailWithCategories(themeId: $themeId) {
      gameId gameTitle year yearCategory screenscraperId
    }
    nominationCountByThemeByCategory { themeId category count }
  }`,
    { themeId },
  );
}

// Render even empty buckets in server-defined display order. Match the theme ID,
// never the title, and do not duplicate year cutoffs in the consumer.
export function categoryRows(view: ThemeView, themeId: number) {
  return view.themeYearCategories.map(({ key, label }) => ({
    key,
    label,
    count:
      view.nominationCountByThemeByCategory.find(
        (row) => row.themeId === themeId && row.category === label,
      )?.count ?? 0,
  }));
}

export interface DashboardView {
  gamesByNomination: {
    id: number;
    screenscraperId: string | null;
    igdbId: string | null;
  }[];
  nominationSuccessPercentByUser: {
    id: number;
    earnedPoints: number;
    successRate: number;
  }[];
  gotyThemesForYear: {
    id: number;
    creationDate: string;
    winnerGameId: number | null;
  }[];
}

export function loadDashboard(
  send: Send,
  nominationType: string,
  creationDate: string,
): Promise<DashboardView> {
  return send<DashboardView>(
    `query Dashboard($type: String!, $date: String!) {
    gamesByNomination(nominationType: $type) { id screenscraperId igdbId }
    nominationSuccessPercentByUser { id earnedPoints successRate }
    gotyThemesForYear(creationDate: $date) { id creationDate winnerGameId }
  }`,
    { type: nominationType, date: creationDate },
  );
}
