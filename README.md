# GOTX GraphQL API

A high-performance, read-only GraphQL API built with **NestJS**, **Node.js**, and **Apollo** on top of **PostgreSQL 16**, migrated from a legacy SQLite application.

## Overview

This service exposes read-only GraphQL queries for browsing games, users, nominations, completions, themes, and aggregated club statistics. All database access uses parameterized queries against PostgreSQL and maps `snake_case` database columns to `camelCase` GraphQL fields.

### Key Modules

- **Games (`src/games`)**: Lookup individual games by ID (`game`) or query nominated games, winners, and runner-ups (`gamesByNomination`).
- **Users (`src/users`)**: Lookup user profiles and point totals by ID (`user`).
- **Nominations (`src/nominations`)**: Query raw nominations (`nominations`) and rich joined nomination details (`nominationData`, `nominationDataByGameId`, `nominationDataByUserId`).
- **Completions (`src/completions`)**: Query completion history by user (`completionsByUserId`), including game titles, theme/nomination context, dates, and `rpgAchievements`.
- **Themes (`src/themes`)**: Browse theme status (`themesWithStatus`), current category winners (`currentWinners`), full theme lineups (`themeDetailWithCategories`), theme winners (`themeWinners`), and GotY year summaries/breakdowns (`gotyThemesByYear`, `gotyThemesForYear`).
- **Stats (`src/stats`)**: Leaderboards, completion counts, nomination counts, win rates/ranks, era/category breakdowns, and time-to-beat aggregations.

## Prerequisites

- **Node.js** (v22+)
- **PostgreSQL 16** with the `public` schema populated (`games`, `users`, `nominations`, `completions`, `themes`, `streaks`)
- **npm** (or your preferred Node package manager)

## Environment Variables

Copy `.env.example` to `.env.local` and edit the fields to match your local database setup.

> **Tip:** Because this API is read-only, connect with a dedicated read-only PostgreSQL role (`SELECT` privileges only) for defense in depth.

## Installation & Running

```bash
# Install dependencies
npm install

# Run in development mode (watch mode + auto schema generation)
npm run start:dev

# Build for production
npm run build

# Run production build
npm run start:prod
```

Once running, the GraphQL endpoint is available at:

```text
http://localhost:4000/graphql
```

## Example Queries

### Single Game & User Lookup

```graphql
query GameAndUser($gameId: Int!, $userId: Int!) {
  game(id: $gameId) {
    id
    title
    year
    systems
    genres
    timeToBeat
  }
  user(id: $userId) {
    id
    name
    earnedPoints
  }
}
```

### Filtered Nomination Game Lists

```graphql
query NominationLists {
  retrobits: gamesByNomination(nominationType: "retro") {
    id
    title
    year
  }
  winningGotm: gamesByNomination(nominationType: "gotm", winner: true) {
    id
    title
    year
  }
  gotmRunnerups: gamesByNomination(nominationType: "gotm", winner: false) {
    id
    title
    year
  }
}
```

### Stats & User Rankings

```graphql
query ClubStats {
  mostCompletedGames(nominationType: "gotm") {
    title
    completions
  }
  avgNominationsBeforeWin
  nominationSuccessPercentByUser {
    rank
    name
    earnedPoints
    successRate
    nominations
    wins
  }
}
```

## Schema & Explorer Notes

- Code-first GraphQL generates `src/schema.gql` automatically when the application starts.
- Adding `description` options to `@ObjectType`, `@Field`, `@Query`, and `@Args` decorators surfaces documentation directly inside GraphQL explorers and **Apollo Sandbox**.
- When using **Apollo Sandbox** from a browser against a remote or Tailnet host, ensure CORS is enabled on the NestJS server so cross-origin requests succeed.

## Database & Data Notes

- **PostgreSQL Migration**: Legacy SQLite functions and types were ported to PostgreSQL idioms (such as `winner = true` booleans, `ARRAY_AGG` / `text[]` arrays for `systems` and `genres`, `TO_CHAR` / `EXTRACT`, and safe regex checks before casting `games.year` strings to integers).
- **Sparse Flags**: Some fields (such as `completions.rpg_achievements`) are present in the schema and exposed in GraphQL even when sparsely populated in historical data.
