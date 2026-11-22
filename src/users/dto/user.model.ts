import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => Int)
  id!: number;

  @Field()
  name!: string;

  @Field(() => Float, { nullable: true })
  earnedPoints?: number;
}
