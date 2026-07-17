import type { Request } from 'express';

// A request carrying ?notrack=1 permanently opts its whole session out of
// AnalyticsEvent logging (see models/analyticsevent.ts) — used for manual or
// automated testing against the live site (e.g. Playwright verification
// runs), so that traffic doesn't skew the real engagement stats. Once set on
// the session, it stays opted out for the rest of that session's lifetime
// without needing to repeat the query param on every request.
export function shouldTrack(req: Request): boolean {
  if (req.query.notrack === '1') req.session.notrack = true;
  return !req.session.notrack;
}
