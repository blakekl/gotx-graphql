import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ThemeDetailEntry {
  @Field(() => Int)
  id!: number;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  nominationType?: string;

  @Field()
  creationDate!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  gameTitle!: string;

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

  @Field(() => Boolean)
  winner!: boolean;

  @Field({ nullable: true })
  nominationDescription?: string;

  @Field({ nullable: true })
  userName?: string;

  @Field()
  yearCategory!: string;
}
