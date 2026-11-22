// Run after npm run build. Uses emitted decorator metadata without starting HTTP or loading .env.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { buildSchema, graphql, isObjectType } from 'graphql';
import { AppResolver } from '../dist/app.resolver.js';
import { UsersResolver } from '../dist/users/users.resolver.js';
import { GamesResolver } from '../dist/games/games.resolver.js';
import { NominationsResolver } from '../dist/nominations/nominations.resolver.js';
import { CompletionsResolver } from '../dist/completions/completions.resolver.js';
import { ThemesResolver } from '../dist/themes/themes.resolver.js';
import { StatsResolver } from '../dist/stats/stats.resolver.js';

const module = await Test.createTestingModule({
  imports: [GraphQLSchemaBuilderModule],
}).compile();
try {
  const schema = await module
    .get(GraphQLSchemaFactory)
    .create([
      AppResolver,
      UsersResolver,
      GamesResolver,
      NominationsResolver,
      CompletionsResolver,
      ThemesResolver,
      StatsResolver,
    ]);
  const user = schema.getType('User');
  assert.ok(isObjectType(user));
  assert.deepEqual(Object.keys(user.getFields()).sort(), [
    'earnedPoints',
    'id',
    'name',
  ]);
  assert.equal(schema.getMutationType(), undefined);
  const documentedSchema = buildSchema(readFileSync('src/schema.gql', 'utf8'));
  const documentedUser = documentedSchema.getType('User');
  assert.ok(isObjectType(documentedUser));
  assert.deepEqual(
    Object.keys(documentedUser.getFields()).sort(),
    Object.keys(user.getFields()).sort(),
  );
  assert.equal(documentedSchema.getMutationType(), undefined);
  for (const field of [
    'discordId',
    'admin',
    'currentPoints',
    'redeemedPoints',
    'premiumPoints',
    'premiumSubscriber',
  ]) {
    const result = await graphql({
      schema,
      source: `{ user(id: 2) { ${field} } }`,
    });
    assert.ok(
      result.errors?.some((error) =>
        error.message.includes(`Cannot query field "${field}"`),
      ),
    );
    assert.equal(result.data, undefined);
  }
  console.log(
    'Executable schema allowlist PASS; private fields rejected; no mutations',
  );
} finally {
  await module.close();
}
