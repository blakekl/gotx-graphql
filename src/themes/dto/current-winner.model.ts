import { Field, Int, ObjectType } from '@nestjs/graphql';

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

  @Field(() => Int, { nullable: true })
  screenscraperId?: number;

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
