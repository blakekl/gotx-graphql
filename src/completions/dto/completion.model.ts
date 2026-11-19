import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Completion {
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

  @Field()
  date!: string;

  @Field()
  nominationType!: string;

  @Field(() => Int, { nullable: true })
  themeId?: number;

  @Field(() => Boolean)
  rpgAchievements!: boolean;
}
