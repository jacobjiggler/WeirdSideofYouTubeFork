'use strict';

// Cloudflare Turnstile server-side verification.
//
// Falls back to Cloudflare's official TEST keys (which ALWAYS PASS) when real
// keys aren't configured, so the submission form works out of the box in dev
// and CI. For real spam protection you MUST set TURNSTILE_SITE_KEY and
// TURNSTILE_SECRET_KEY (from the Cloudflare dashboard) in production.
var TEST_SITE_KEY = '1x00000000000000000000AA';
var TEST_SECRET_KEY = '1x0000000000000000000000000000000AA';

exports.siteKey = process.env.TURNSTILE_SITE_KEY || TEST_SITE_KEY;
var secretKey = process.env.TURNSTILE_SECRET_KEY || TEST_SECRET_KEY;

// True when no real secret is configured (handy for a dashboard warning banner).
exports.usingTestKeys = !process.env.TURNSTILE_SECRET_KEY;

// Verify a Turnstile response token. Resolves true only if Cloudflare confirms it.
exports.verify = async function (token, remoteip) {
  if (!token) return false;
  try {
    var body = new URLSearchParams();
    body.append('secret', secretKey);
    body.append('response', String(token));
    if (remoteip) body.append('remoteip', String(remoteip));

    var resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });
    var data = await resp.json();
    return data.success === true;
  } catch (err) {
    console.error('Turnstile verify error: ' + err.message);
    return false;
  }
};
