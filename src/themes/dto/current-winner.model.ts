import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CurrentWinner {
  @Field()
  nominationType!: string;

  @Field()
  themeTitle!: string;

  @Field(() => Int)
  themeId!: number;

  @Field()
  creationDate!: string;

  @Field({ nullable: true })
  themeDescription?: string;

  @Field(() => Int)
  gameId!: number;

  @Field()
  title!: string;

  @Field(() => ID, { nullable: true })
  screenscraperId?: string | null;

  @Field({ nullable: true })
  year?: string;

  @Field(() => [String], { nullable: true })
  systems?: string[];

  @Field({ nullable: true })
  developer?: string;

  @Field(() => [String], { nullable: true })
  genres?: string[];

  @Field({ nullable: true })
  imgUrl?: string;

  @Field(() => Int, { nullable: true })
  timeToBeat?: number;

  @Field()
  yearCategory!: string;

  @Field(() => Int)
  nominationCount!: number;
}
