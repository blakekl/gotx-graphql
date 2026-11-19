import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Nomination {
  @Field(() => Int)
  id!: number;

  @Field()
  nominationType!: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Boolean)
  winner!: boolean;

  @Field(() => Int, { nullable: true })
  gameId?: number;

  @Field(() => Int, { nullable: true })
  userId?: number;

  @Field(() => Int, { nullable: true })
  themeId?: number;
}
