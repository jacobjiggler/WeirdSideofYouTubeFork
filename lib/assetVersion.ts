// Content-addressed cache busting for static assets. Appending ?v=<hash of the
// file's actual bytes> to CSS/JS URLs means the URL itself changes whenever a
// deploy changes the file, so both browsers and Cloudflare's edge can safely
// cache the asset for a very long time (see app.ts) without ever serving a
// stale copy after a deploy.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

const hashCache = new Map<string, string>();

// Static files are served from both public/ and dist/ (see app.ts) — try both.
const STATIC_ROOTS = ['public', 'dist'];

function hashOf(relPath: string): string {
  const cached = hashCache.get(relPath);
  if (cached) return cached;

  for (const root of STATIC_ROOTS) {
    try {
      const bytes = readFileSync(path.join(__dirname, '..', root, relPath));
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
      hashCache.set(relPath, hash);
      return hash;
    } catch {
      // not in this root — try the next one
    }
  }

  // File not found (shouldn't happen in practice) — fall back to a constant so
  // the URL is still valid, just not cache-busted.
  return 'na';
}

// relPath is the same path used in the <link>/<script> tag, e.g. '/css/WeirdStyle.css'.
export function assetUrl(relPath: string): string {
  return relPath + '?v=' + hashOf(relPath);
}
