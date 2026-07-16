// dependencies
import express, { type ErrorRequestHandler } from 'express';
import path from 'path';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

// express middleware
import logger from 'morgan';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import errorHandler from 'errorhandler';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

// app modules (still JavaScript — typed as `any` until migrated)
import Account from './models/account';
import database from './config/db';
import setupRouter from './router';
import { assetUrl } from './lib/assetVersion';

// global config
const app = express();
const env = process.env.NODE_ENV || 'development';
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('view options', { layout: false });
app.locals.assetUrl = assetUrl;

// We sit behind the Cloudflare tunnel / reverse proxy, so trust the first proxy
// hop. This makes req.secure / req.ip reflect the real client (needed for secure
// cookies and accurate rate-limiting).
app.set('trust proxy', 1);

// Security headers. CSP and COEP are disabled because the site loads third-party
// assets (CDN fonts, the YouTube IFrame player) and uses inline scripts.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'CHANGEMESECRET'));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.SESSION_SECRET || 'sessionsecret',
  // Persist sessions in MongoDB instead of the default in-memory MemoryStore, so
  // logins survive app restarts/deploys and memory doesn't leak in production.
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1/weirdtube',
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60          // server-side session lifetime: 7 days (seconds)
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env === 'production',  // require HTTPS in production (served via Cloudflare)
    maxAge: 7 * 24 * 60 * 60 * 1000 // keep the login cookie for 7 days
  }
}));
app.use(passport.initialize());
app.use(passport.session());
// Static assets are served with a content-hashed ?v= query string (see
// lib/assetVersion.ts and its use in views), so the URL itself changes
// whenever a deploy changes a file's contents. That makes a very long,
// immutable cache safe for both browsers and Cloudflare's edge — no risk of
// serving a stale asset after a deploy.
const staticOptions = { maxAge: '1y', immutable: true };
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use(express.static(path.join(__dirname, 'dist'), staticOptions));

// Everything past this point is a dynamic route (session/user-specific nav,
// CSRF-token-bearing forms like /login and /submit, the admin panel, the
// JSON API). None of it may ever be cached — by a browser, an intermediate
// proxy, or Cloudflare's edge — regardless of what caching rules exist
// upstream, since a cached CSRF token or logged-in nav would be served to
// every subsequent visitor. Static requests above already returned before
// reaching this middleware, so this only touches genuinely dynamic responses.
app.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

// Rate limiting. Protects login from brute force and the API from abuse.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// Dev-only verbose error pages with stack traces. In production we install no
// errorhandler here, so Express's default handler returns a generic 500.
// (The old dumpExceptions/showStack options were legacy Connect options that the
// modern `errorhandler` package ignores — its dev output is verbose by default.)
if (env === 'development') {
  app.use(errorHandler());
}

// passport config. The passport-local-mongoose plugin adds these statics at
// runtime; they aren't on the base Mongoose Model type, so cast to reach them.
const AccountAuth = Account as unknown as {
  authenticate: () => (username: string, password: string, cb: unknown) => void;
  serializeUser: () => (user: unknown, cb: unknown) => void;
  deserializeUser: () => (id: unknown, cb: unknown) => void;
};
passport.use(new LocalStrategy(AccountAuth.authenticate()));
passport.serializeUser(AccountAuth.serializeUser());
passport.deserializeUser(AccountAuth.deserializeUser());

// mongoose
mongoose.connect(database.url);

// routes
setupRouter(app);

// CSRF error handler — invalid/missing token yields a clean 403 instead of a 500.
const csrfErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    res.status(403).send('Form expired or invalid (CSRF). Go back and try again.');
    return;
  }
  next(err);
};
app.use(csrfErrorHandler);

const port = app.get('port');
app.listen(port, () => {
  console.log('Express server listening on port ' + port);
});
