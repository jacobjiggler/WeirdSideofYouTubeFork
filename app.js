// dependencies
var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

// express middleware
var logger = require('morgan');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var errorHandler = require('errorhandler');
var helmet = require('helmet');
var rateLimit = require('express-rate-limit').rateLimit;

// global config
var app = express();
var env = process.env.NODE_ENV || 'development';
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.set('view options', { layout: false });

// We sit behind the Cloudflare tunnel / reverse proxy, so trust the first proxy
// hop. This makes req.secure / req.ip reflect the real client (needed for secure
// cookies and accurate rate-limiting).
app.set('trust proxy', 1);

// Security headers. CSP and COEP are disabled because the site loads third-party
// assets (PureCSS/jQuery CDNs, Google Fonts, the YouTube IFrame player) and uses
// inline scripts; a proper CSP can be added later as part of modernization.
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
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env === 'production'   // require HTTPS in production (served via Cloudflare)
  }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'dist')));

// Rate limiting. Protects login from brute force and the API (which proxies the
// YouTube quota) from abuse.
var apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

// env config — dev-only verbose error pages with stack traces.
// In production we deliberately install no errorhandler here, so Express's
// default handler returns a generic 500 with no stack leak.
if ('development' == env) {
  app.use(errorHandler({ dumpExceptions: true, showStack: true }));
}

// passport config
var Account = require('./models/account');
passport.use(new LocalStrategy(Account.authenticate()));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

// mongoose
var database = require('./config/db');
mongoose.connect(database.url);

// routes
require('./router')(app);

// CSRF error handler — invalid/missing token yields a clean 403 instead of a 500.
app.use(function (err, req, res, next) {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send('Form expired or invalid (CSRF). Go back and try again.');
  }
  return next(err);
});

app.listen(app.get('port'), function(){
  console.log(('Express server listening on port ' + app.get('port')));
});
