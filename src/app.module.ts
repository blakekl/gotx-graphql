import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from './database/database.module.js';
import { AppResolver } from './app.resolver.js';
import { GamesModule } from './games/games.module.js';
import { UsersModule } from './users/users.module.js';
import { NominationsModule } from './nominations/nominations.module.js';
import { CompletionsModule } from './completions/completions.module.js';
import { ThemesModule } from './themes/themes.module.js';
import { StatsModule } from './stats/stats.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Contract tests supply isolated synthetic configuration, never local secrets.
      ignoreEnvFile: process.env.NODE_ENV !== 'local',
      envFilePath: '.env.local',
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: true,
    }),
    DatabaseModule,
    GamesModule,
    UsersModule,
    NominationsModule,
    CompletionsModule,
    ThemesModule,
    StatsModule,
  ],
  providers: [AppResolver],
  controllers: [HealthController],
})
export class AppModule {}
