// Canonical display definitions also generate SQL assignment; consumers must not
// reconstruct the historical cutoff independently. SQL aliases are always t/g.
export interface YearCategoryDefinition {
  key: string;
  label: string;
  minYear: number | null;
  maxYear: number | null;
}

const MODERN_THEME_ID = 235;

export function yearCategories(themeId: number): YearCategoryDefinition[] {
  const modern = themeId >= MODERN_THEME_ID;
  return [
    { key: 'PRE_96', label: 'pre 96', minYear: null, maxYear: 1995 },
    {
      key: 'MID',
      label: modern ? '96-01' : '96-99',
      minYear: 1996,
      maxYear: modern ? 2001 : 1999,
    },
    {
      key: 'RECENT',
      label: modern ? '02+' : '2k+',
      minYear: modern ? 2002 : 2000,
      maxYear: null,
    },
    { key: 'UNKNOWN', label: 'Unknown', minYear: null, maxYear: null },
  ];
}

// Guard the conversion inside CASE, not a WHERE/AND whose evaluation PostgreSQL
// can reorder. Bounded unsigned decimal text within Int range is determinable;
// null, malformed or oversized text is Unknown, never a failing integer cast.
const SAFE_YEAR = `(CASE WHEN g.year ~ '^[0-9]{1,10}$'
  THEN CASE WHEN g.year::numeric <= 2147483647 THEN g.year::numeric END END)`;

function categoryCase(themeId: number): string {
  const clauses = yearCategories(themeId)
    .filter(({ key }) => key !== 'UNKNOWN')
    .map(({ label, minYear, maxYear }) => {
      const bounds = [
        minYear === null ? null : `${SAFE_YEAR} >= ${minYear}`,
        maxYear === null ? null : `${SAFE_YEAR} <= ${maxYear}`,
      ]
        .filter(Boolean)
        .join(' AND ');
      return `WHEN ${bounds} THEN '${label}'`;
    });
  return `CASE ${clauses.join(' ')} ELSE 'Unknown' END`;
}

export const YEAR_CATEGORY_SQL = `CASE WHEN t.id < ${MODERN_THEME_ID}
  THEN ${categoryCase(MODERN_THEME_ID - 1)} ELSE ${categoryCase(MODERN_THEME_ID)} END`;
