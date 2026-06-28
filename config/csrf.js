// Shared CSRF protection middleware.
//
// Cookie-backed (not session-backed) on purpose: sessions live in the in-memory
// MemoryStore, which is wiped on every app restart. A session-backed CSRF secret
// would therefore invalidate every previously-rendered form whenever the app
// restarts ("Form expired or invalid"). Storing the secret in a cookie keeps it
// stable across restarts.
var csrf = require('csurf');

module.exports = csrf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
});
