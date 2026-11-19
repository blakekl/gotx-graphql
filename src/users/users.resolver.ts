import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { User } from './dto/user.model.js';
import { UsersService } from './users.service.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { nullable: true, name: 'user' })
  async getUserById(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<User | null> {
    return this.usersService.findById(id);
  }
}
