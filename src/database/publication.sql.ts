// SQL-only public dashboard relations. Dates never publish a theme. Keep every
// theme/nomination-derived query (including nested aggregate filters) on these
// relations; filtering mapped response rows is too late to protect aggregates.
export const PUBLICATION_CTES = `
  published_themes AS (
    SELECT theme.*
    FROM public.themes theme
    WHERE EXISTS (
      SELECT 1 FROM public.nominations winner
      WHERE winner.theme_id = theme.id AND winner.winner = true
    )
  ),
  published_nominations AS (
    SELECT nomination.*
    FROM public.nominations nomination
    INNER JOIN published_themes theme ON theme.id = nomination.theme_id
  )
`;
