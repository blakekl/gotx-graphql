import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Game {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;

  @Field({ nullable: true })
  titleWorld?: string;

  @Field({ nullable: true })
  titleUsa?: string;

  @Field({ nullable: true })
  titleEu?: string;

  @Field({ nullable: true })
  titleJp?: string;

  @Field({ nullable: true })
  titleOther?: string;

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

  @Field(() => Float, { nullable: true })
  screenscraperId?: number;

  @Field(() => Float, { nullable: true })
  igdbId?: number;
}
