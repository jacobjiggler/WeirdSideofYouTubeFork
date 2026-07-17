// Augment Express/session types with the app-specific fields used across the
// controllers, so req.session.seenVideos, req.user.username and req.csrfToken()
// are properly typed.
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    seenVideos?: string[];
    // Set once a request carries ?notrack=1 (see controllers/root.ts); once
    // set, the whole session is excluded from AnalyticsEvent logging. Used
    // for manual/automated testing (e.g. Playwright verification runs)
    // against the live site, so that traffic doesn't skew the real stats.
    notrack?: boolean;
  }
}

declare global {
  namespace Express {
    interface User {
      username: string;
      admin?: boolean;
    }
    interface Request {
      // Set by the csrf attachToken middleware on the routes that render forms.
      csrfToken?: () => string;
    }
  }
}
