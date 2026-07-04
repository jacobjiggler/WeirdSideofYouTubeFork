// Augment Express/session types with the app-specific fields used across the
// controllers, so req.session.seenVideos, req.user.username and req.csrfToken()
// are properly typed.
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    seenVideos?: string[];
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
