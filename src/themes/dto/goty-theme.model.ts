import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GotyThemeYearSummary {
  @Field()
  creationDate!: string;

  @Field(() => Int)
  year!: number;

  @Field(() => Int)
  themeCount!: number;

  @Field(() => Int)
  totalWinners!: number;

  @Field(() => [String])
  categoryTitles!: string[];
}

@ObjectType()
export class GotyThemeDetail {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  creationDate!: string;

  @Field(() => Int)
  nominationCount!: number;

  @Field(() => Int)
  winnerCount!: number;

  @Field({ nullable: true })
  winnerTitle?: string;

  @Field(() => Int, { nullable: true })
  winnerGameId?: number;

  @Field(() => ID, { nullable: true })
  winnerScreenscraperId?: string | null;
}
