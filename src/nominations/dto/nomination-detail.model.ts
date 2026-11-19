import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NominationDetail {
  @Field({ nullable: true })
  title?: string;

  @Field()
  nominationType!: string;

  @Field(() => Int, { nullable: true })
  gameId?: number;

  @Field({ nullable: true })
  userName?: string;

  @Field({ nullable: true })
  gameDescription?: string;

  @Field({ nullable: true })
  themeTitle?: string;

  @Field({ nullable: true })
  themeDescription?: string;

  @Field({ nullable: true })
  date?: string;

  @Field(() => Boolean)
  winner!: boolean;
}
