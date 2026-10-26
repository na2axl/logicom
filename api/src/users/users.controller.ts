import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './current-user.js';
import { USERS, type User } from './user.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Known users and their role (feeds the user selector)',
  })
  list(): readonly User[] {
    return USERS;
  }
}
