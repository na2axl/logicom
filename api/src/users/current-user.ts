import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { BusinessError } from '../common/business-error.js';
import { findUser, type User } from './user.js';

export const USER_HEADER = 'x-user-id';

const IS_PUBLIC = 'isPublic';

/** Marks a route as callable without the X-User-Id header. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

type RequestWithUser = Request & { user?: User };

/**
 * Global guard: resolves the X-User-Id header into a known user (401 otherwise).
 * Authorization by role is a business rule and lives in the domain layer.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userId = request.header(USER_HEADER);
    const user = findUser(userId);
    if (!user) {
      throw new BusinessError(
        'unauthorized',
        'UNKNOWN_USER',
        userId ? `Unknown user "${userId}".` : 'Missing X-User-Id header.',
      );
    }
    request.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user as User;
  },
);
