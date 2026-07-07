// Extract an 11-character YouTube video id from a URL or a bare id, or null.
// Handles watch?v=, youtu.be/, /shorts/, /embed/, and /v/ forms.
export function extractVideoId(input: unknown): string | null {
  const s = String(input == null ? '' : input).trim();
  if (!s || s.length > 500) return null;

  // Already a bare id.
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;

  const m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}
