import { Schema, model } from 'mongoose';

// Lightweight anonymous event log for the three admin stats questions:
// avg videos watched per session, landing-without-clicking-Get-Weird rate,
// and which video sessions end on most often. sessionID is the existing
// express-session id (same cookie already used for seenVideos dedup) — no
// new session concept, so "session" here can span up to the cookie's 7-day
// lifetime rather than a single sitting.
const AnalyticsEvent = new Schema({
  sessionID: String,
  type: { type: String, enum: ['page_view', 'video_played'] },
  videoID: String, // only set for type: 'video_played'
  time: { type: Date, default: Date.now }
}, {
  // Same pattern as VideoHistory, but larger: this logs every anonymous
  // visitor too (not just logged-in users), so volume is much higher.
  capped: { size: 50000000 }
});

AnalyticsEvent.index({ sessionID: 1, time: 1 });

export = model('AnalyticsEvent', AnalyticsEvent);
