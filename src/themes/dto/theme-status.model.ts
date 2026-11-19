import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ThemeWithStatus {
  @Field(() => Int)
  id!: number;

  @Field({ nullable: true })
  nominationType?: string;

  @Field()
  creationDate!: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  status!: string;

  @Field({ nullable: true })
  displayTitle?: string;

  @Field(() => Int)
  nominationCount!: number;

  @Field(() => Int)
  winnerCount!: number;
}
