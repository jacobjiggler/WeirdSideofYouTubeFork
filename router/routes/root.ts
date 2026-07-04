import express from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import root from '../../controllers/root';
import submit from '../../controllers/submit';
import { attachToken, csrfProtection } from '../../config/csrf';

const router = express.Router();

// Throttle login attempts to slow brute-force guessing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please wait 15 minutes and try again.'
});

// Throttle public submissions per IP (on top of the Turnstile captcha).
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many submissions from this address. Please try again later.'
});

// Coerce the submitted URL to a string (NoSQL-injection defense).
function coerceSubmit(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && req.body.url != null) req.body.url = String(req.body.url);
  next();
}

// Coerce credential fields to strings so crafted objects (e.g. username[$gt])
// can't reach Mongoose as query operators (NoSQL injection defense).
function coerceCredentials(req: Request, _res: Response, next: NextFunction): void {
  if (req.body) {
    if (req.body.username != null) req.body.username = String(req.body.username);
    if (req.body.password != null) req.body.password = String(req.body.password);
  }
  next();
}

router.get('/', root.getIndex);
router.get('/login', attachToken, root.getLogin);
router.post('/login', loginLimiter, coerceCredentials, csrfProtection, root.postLogin);
router.get('/logout', root.getLogout);
router.get('/about', root.getAbout);
router.get('/butwhy', root.getButWhy);
router.get('/history', root.getHistory);
router.get('/submit', attachToken, submit.getSubmit);
router.post('/submit', submitLimiter, coerceSubmit, csrfProtection, attachToken, submit.postSubmit);

export = router;
