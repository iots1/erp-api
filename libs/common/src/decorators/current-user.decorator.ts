import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IUserSession } from '@lib/common/interfaces/auth.interface';

const GuestSession: IUserSession = {
  id: null,
  username: null,
  fullname: null,
  email: null,
  roles: [],
  permissions: [],
  jti: null,
};

type RequestWithUserSession = {
  user?: { user_session: IUserSession };
};

/**
 * Injects the authenticated user session into a controller handler.
 * Returns a guest session when the request is unauthenticated (public route).
 *
 * @example
 * findAll(@CurrentUser() user: IUserSession) {}
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IUserSession => {
    const request = ctx.switchToHttp().getRequest<RequestWithUserSession>();
    return request.user?.user_session ?? GuestSession;
  },
);
