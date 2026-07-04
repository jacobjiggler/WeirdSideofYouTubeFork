// Shared CSRF protection (double-submit cookie pattern via csrf-csrf).
//
// Cookie-backed (not session-backed) on purpose: a session-backed CSRF secret
// would invalidate every previously-rendered form whenever the app restarts.
// csrf-csrf v3 implements a stateless double-submit cookie, so tokens stay valid
// across restarts and work for anonymous visitors (e.g. the login page).
import { doubleCsrf } from 'csrf-csrf';
import type { Request, RequestHandler } from 'express';

const isProd = process.env.NODE_ENV === 'production';

const utils = doubleCsrf({
  getSecret: () => process.env.COOKIE_SECRET || 'CHANGEMESECRET',
  cookieName: '_csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/'
  },
  size: 64,
  // The token arrives in the hidden _csrf form field, or an X-CSRF-Token header
  // for JS-driven posts.
  getTokenFromRequest: (req: Request) =>
    (req.body?._csrf as string) || (req.headers['x-csrf-token'] as string)
});

// Validation middleware for state-changing routes. On GET/HEAD/OPTIONS it passes
// through (those methods are ignored by default). On an invalid token it calls
// next() with an error whose .code is 'EBADCSRFTOKEN' (handled in app.ts).
export const csrfProtection = utils.doubleCsrfProtection;

// Attaches req.csrfToken() so existing controllers and EJS views keep working
// unchanged. generateToken(req, res, overwrite=false, validateOnReuse=false)
// reuses a valid token but silently regenerates a stale/invalid one instead of
// throwing — this self-heals existing visitors.
export const attachToken: RequestHandler = (req, res, next) => {
  (req as Request & { csrfToken: () => string }).csrfToken = () =>
    utils.generateToken(req, res, false, false);
  next();
};
