import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GameCompletionStat {
  @Field()
  title!: string;

  @Field(() => Int)
  completions!: number;
}

@ObjectType()
export class GameNominationCountStat {
  @Field()
  title!: string;

  @Field(() => Int)
  total!: number;
}

@ObjectType()
export class UserWinStat {
  @Field()
  name!: string;

  @Field(() => Int)
  wins!: number;
}

@ObjectType()
export class UserNominationCountStat {
  @Field()
  name!: string;

  @Field(() => Int)
  nominations!: number;
}

@ObjectType()
export class ThemeTimeToBeatStat {
  @Field()
  theme!: string;

  @Field(() => Float, { nullable: true })
  value?: number;
}

@ObjectType()
export class GameNominationCompletionStat {
  @Field()
  title!: string;

  @Field(() => Int)
  completions!: number;

  @Field(() => Int, { nullable: true })
  themeId?: number;

  @Field()
  nominationType!: string;
}

@ObjectType()
export class UserNominationSuccessStat {
  @Field(() => Int)
  rank!: number;

  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => Float)
  earnedPoints!: number;

  @Field(() => Int)
  successRate!: number;

  @Field(() => Int)
  nominations!: number;

  @Field(() => Int)
  wins!: number;
}

@ObjectType()
export class ThemeCategoryCountStat {
  @Field()
  title!: string;

  @Field()
  category!: string;

  @Field(() => Int)
  count!: number;
}
