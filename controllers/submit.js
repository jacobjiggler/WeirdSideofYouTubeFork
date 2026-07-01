'use strict';

var Submission = require('../models/submission');
var turnstile = require('../config/turnstile');

// Parse a pasted string into { type, sourceId, originalUrl } or null.
// Accepts YouTube video links/ids and playlist links/ids. A watch URL that
// carries both v= and list= is treated as a single video (paste the
// /playlist?list= URL to submit a whole playlist).
function parseSubmission(raw) {
  var url = String(raw == null ? '' : raw).trim();
  if (!url || url.length > 500) return null;

  var listMatch = url.match(/[?&]list=([A-Za-z0-9_-]{10,50})/);
  var hasVideoParam = /[?&]v=/.test(url);
  var isPlaylistUrl = /\/playlist\?/i.test(url) || (listMatch && !hasVideoParam);
  if (isPlaylistUrl && listMatch) {
    return { type: 'playlist', sourceId: listMatch[1], originalUrl: url };
  }

  var videoMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
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
exports.parseSubmission = parseSubmission;

function renderForm(req, res, opts) {
  res.render('submit', {
    user: req.user,
    csrfToken: req.csrfToken(),
    turnstileSiteKey: turnstile.siteKey,
    submitted: opts.submitted || false,
    error: opts.error || null
  });
}

exports.getSubmit = function (req, res) {
  renderForm(req, res, { submitted: req.query.submitted === '1' });
};

exports.postSubmit = async function (req, res) {
  // Honeypot: bots fill this hidden field. Silently pretend success.
  if (req.body && req.body.website) {
    return res.redirect('/submit?submitted=1');
  }

  // Captcha
  var token = req.body && req.body['cf-turnstile-response'];
  var passed = await turnstile.verify(token, req.ip);
  if (!passed) {
    res.status(400);
    return renderForm(req, res, { error: 'Captcha check failed. Please try again.' });
  }

  // Validate + parse the link
  var parsed = parseSubmission(req.body && req.body.url);
  if (!parsed) {
    res.status(400);
    return renderForm(req, res, { error: "That doesn't look like a YouTube video or playlist link." });
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
    return res.redirect('/submit?submitted=1');
  } catch (err) {
    console.error(err);
    res.status(500);
    return renderForm(req, res, { error: 'Something went wrong saving your submission. Please try again.' });
  }
};
