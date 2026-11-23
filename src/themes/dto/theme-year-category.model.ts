import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ThemeYearCategory {
  @Field()
  key!: string;

  @Field()
  label!: string;

  @Field(() => Int, { nullable: true })
  minYear!: number | null;

  @Field(() => Int, { nullable: true })
  maxYear!: number | null;
}
