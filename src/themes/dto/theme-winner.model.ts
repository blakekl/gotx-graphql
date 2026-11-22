import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ThemeWinner {
  @Field()
  title!: string;

  @Field(() => Int)
  gameId!: number;

  @Field({ nullable: true })
  year?: string;

  @Field(() => Float, { nullable: true })
  screenscraperId?: number;

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

  @Field({ nullable: true })
  nominationDescription?: string;

  @Field({ nullable: true })
  userName?: string;

  @Field()
  yearCategory!: string;
}
