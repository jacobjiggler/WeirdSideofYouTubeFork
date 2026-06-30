// Shared CSRF protection (double-submit cookie pattern via csrf-csrf).
//
// Cookie-backed (not session-backed) on purpose: sessions live in the in-memory
// MemoryStore, which is wiped on every app restart. A session-backed CSRF secret
// would invalidate every previously-rendered form whenever the app restarts.
// csrf-csrf v3 implements a stateless double-submit cookie, so tokens stay valid
// across restarts and work for anonymous visitors (e.g. the login page).
'use strict';

var doubleCsrf = require('csrf-csrf').doubleCsrf;

var isProd = process.env.NODE_ENV === 'production';

var utils = doubleCsrf({
  getSecret: function () { return process.env.COOKIE_SECRET || 'CHANGEMESECRET'; },
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
  getTokenFromRequest: function (req) {
    return (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  }
});

// Validation middleware for state-changing routes. On GET/HEAD/OPTIONS it passes
// through (those methods are ignored by default). On an invalid token it calls
// next() with an error whose .code is 'EBADCSRFTOKEN' (handled in app.js).
exports.csrfProtection = utils.doubleCsrfProtection;

// Attaches req.csrfToken() so existing controllers and EJS views keep working
// unchanged. Calling it mints a token and sets the paired cookie.
//
// generateToken(req, res, overwrite=false, validateOnReuse=false): reuse the
// existing valid token when present, but if the cookie is stale or invalid
// (e.g. a leftover cookie from the old csurf implementation), regenerate it
// silently instead of throwing. This self-heals existing visitors.
exports.attachToken = function (req, res, next) {
  req.csrfToken = function () { return utils.generateToken(req, res, false, false); };
  next();
};
