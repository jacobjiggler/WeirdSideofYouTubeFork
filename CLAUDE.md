# Project Rules

## Before declaring any task done

1. Take a screenshot of https://weirdtube.wtf using the browser/playwright tools and visually confirm the page looks correct — not just a 200 status code.
2. For any UI change (CSS, templates, layout, new pages), also screenshot the specific page or element that changed and confirm it renders as intended.
3. If the site is down or looks broken, investigate and fix before wrapping up — never declare done on a broken site.
4. For CSS/JS changes, verify against a fresh fetch (`fetch(url, {cache: 'no-store'})`) or a brand-new browser session, not just a re-navigate in an already-open Playwright session. Both Cloudflare's edge cache (~4h) and the browser's own HTTP cache can silently keep serving the pre-change bundle to a session that already loaded the page earlier, making a real fix look broken (or a real regression look fine).
5. Layout rules that depend on "space available below the navbar" (or similar) must not use a fixed vh/vw guess — the navbar's height changes (e.g. logged out vs. logged-in admin with more menu items). Compute it from actual layout (`getBoundingClientRect`/`innerHeight`) instead, and add a unit test asserting the result never exceeds the viewport.
