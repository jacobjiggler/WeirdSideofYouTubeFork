import Submission = require('../models/submission');
import { siteKey, verify } from '../config/turnstile';
import type { Request, Response } from 'express';

interface Parsed {
  type: 'video' | 'playlist';
  sourceId: string;
  originalUrl: string;
}

// Parse a pasted string into { type, sourceId, originalUrl } or null. A watch URL
// carrying both v= and list= is treated as a single video (paste the /playlist?
// list= URL to submit a whole playlist).
function parseSubmission(raw: unknown): Parsed | null {
  const url = String(raw == null ? '' : raw).trim();
  if (!url || url.length > 500) return null;

  const listMatch = url.match(/[?&]list=([A-Za-z0-9_-]{10,50})/);
  const hasVideoParam = /[?&]v=/.test(url);
  const isPlaylistUrl = /\/playlist\?/i.test(url) || (listMatch && !hasVideoParam);
  if (isPlaylistUrl && listMatch) {
    return { type: 'playlist', sourceId: listMatch[1], originalUrl: url };
  }

  const videoMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  if (videoMatch) {
    return { type: 'video', sourceId: videoMatch[1], originalUrl: url };
  }

  if (/^[A-Za-z0-9_-]{11}$/.test(url)) {
    return { type: 'video', sourceId: url, originalUrl: url };
  }
  if (/^(PL|UU|LL|FL|OL|RD)[A-Za-z0-9_-]{8,48}$/.test(url)) {
    return { type: 'playlist', sourceId: url, originalUrl: url };
  }
  return null;
}

function renderForm(req: Request, res: Response, opts: { submitted?: boolean; error?: string | null }): void {
  res.render('submit', {
    user: req.user,
    csrfToken: req.csrfToken!(),
    turnstileSiteKey: siteKey,
    submitted: opts.submitted || false,
    error: opts.error || null
  });
}

const submit = {
  parseSubmission,

  getSubmit(req: Request, res: Response): void {
    renderForm(req, res, { submitted: req.query.submitted === '1' });
  },

  async postSubmit(req: Request, res: Response): Promise<void> {
    // Honeypot: bots fill this hidden field. Silently pretend success.
    if (req.body && req.body.website) {
      res.redirect('/submit?submitted=1');
      return;
    }

    // Captcha
    const token = req.body && req.body['cf-turnstile-response'];
    const passed = await verify(token, req.ip);
    if (!passed) {
      res.status(400);
      renderForm(req, res, { error: 'Captcha check failed. Please try again.' });
      return;
    }

    // Validate + parse the link
    const parsed = parseSubmission(req.body && req.body.url);
    if (!parsed) {
      res.status(400);
      renderForm(req, res, { error: "That doesn't look like a YouTube video or playlist link." });
      return;
    }

    try {
      await Submission.create({
        type: parsed.type,
        sourceId: parsed.sourceId,
        originalUrl: parsed.originalUrl.slice(0, 500),
        userAgent: String((req.headers && req.headers['user-agent']) || '').slice(0, 400),
        ip: req.ip,
        status: 'pending'
      });
      res.redirect('/submit?submitted=1');
    } catch (err) {
      console.error(err);
      res.status(500);
      renderForm(req, res, { error: 'Something went wrong saving your submission. Please try again.' });
    }
  }
};

export = submit;
