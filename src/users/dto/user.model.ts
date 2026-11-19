import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field({ nullable: true })
  discordId?: string;

  @Field(() => Float, { nullable: true })
  earnedPoints?: number;

  @Field(() => Float, { nullable: true })
  currentPoints?: number;

  @Field(() => Float, { nullable: true })
  redeemedPoints?: number;

  @Field(() => Float, { nullable: true })
  premiumPoints?: number;

  @Field(() => Boolean)
  admin!: boolean;
}
