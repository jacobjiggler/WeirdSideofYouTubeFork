var express = require('express');
var router = express.Router();
var rateLimit = require('express-rate-limit').rateLimit;
var root = require('../../controllers/root');
var csrf = require('../../config/csrf');

// Throttle login attempts to slow brute-force guessing.
var loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please wait 15 minutes and try again.'
});

// Coerce credential fields to strings so crafted objects (e.g. username[$gt])
// can't reach Mongoose as query operators (NoSQL injection defense).
function coerceCredentials(req, res, next) {
  if (req.body) {
    if (req.body.username != null) req.body.username = String(req.body.username);
    if (req.body.password != null) req.body.password = String(req.body.password);
  }
  next();
}

router.get('/', root.getIndex);
router.get('/login', csrf.attachToken, root.getLogin);
router.post('/login', loginLimiter, coerceCredentials, csrf.csrfProtection, root.postLogin);
router.get('/logout', root.getLogout);
router.get('/about', root.getAbout);
router.get('/butwhy', root.getButWhy);
router.get('/history', root.getHistory);

module.exports = router;
