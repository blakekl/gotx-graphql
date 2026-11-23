import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { PositiveIntPipe } from '../validation/query-arguments.js';
import { User } from './dto/user.model.js';
import { UsersService } from './users.service.js';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User, { nullable: true, name: 'user' })
  async getUserById(
    @Args('id', { type: () => Int }, PositiveIntPipe) id: number,
  ): Promise<User | null> {
    return this.usersService.findById(id);
  }
}
