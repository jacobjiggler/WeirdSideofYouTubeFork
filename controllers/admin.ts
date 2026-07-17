import Video = require('../models/video');
import Submission = require('../models/submission');
import AnalyticsEvent = require('../models/analyticsevent');
import api = require('./api');
import reddit = require('./reddit');
import type { Request, Response, NextFunction } from 'express';

// Promise wrapper around the callback-based api.addVideo.
function addVideoPromise(idOrUrl: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    api.addVideo(idOrUrl, (err: unknown, vid?: unknown) => {
      if (err) reject(err); else resolve(vid);
    });
  });
}

// Expand a playlist into individual videos via the YouTube API and add each.
// Capped at 4 pages (200 videos) to bound abuse from a huge playlist.
async function addPlaylist(playlistId: string): Promise<number> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY is not set');
  let added = 0, pageToken = '', pages = 0;
  do {
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' +
      encodeURIComponent(playlistId) + '&key=' + key + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const resp = await fetch(url);
    if (!resp.ok) break;
    const data: any = await resp.json();
    const items = data.items || [];
    for (let i = 0; i < items.length; i++) {
      const vidId = items[i].contentDetails && items[i].contentDetails.videoId;
      if (vidId) { await addVideoPromise(vidId); added++; }
    }
    pageToken = data.nextPageToken || '';
    pages++;
  } while (pageToken && pages < 4);
  return added;
}

// Best-effort title lookup for the stats page's top-ending-videos list. Stats
// are still useful without titles, so failures here are swallowed.
async function lookupTitles(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const key = process.env.YOUTUBE_API_KEY;
  if (!key || !ids.length) return out;
  try {
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' +
      ids.map(encodeURIComponent).join(',') + '&key=' + key;
    const resp = await fetch(url);
    if (!resp.ok) return out;
    const data: any = await resp.json();
    (data.items || []).forEach((item: any) => {
      if (item.id && item.snippet && item.snippet.title) out[item.id] = item.snippet.title;
    });
  } catch (err) {
    console.error(err);
  }
  return out;
}

const admin = {
  // middleware for requiring admin permissions
  needsAdmin(req: Request, res: Response, next: NextFunction): void {
    if (req.user && req.user.admin === true) {
      next();
    } else {
      res.redirect('/login');
    }
  },

  getIndex(req: Request, res: Response): void {
    res.render('admin/index', { user: req.user, csrfToken: req.csrfToken!() });
  },

  postSubmitVid(req: Request, res: Response): void {
    api.addVideo(req.body.videoID, (err: unknown) => {
      if (err) console.log(err);
      else res.redirect('/admin');
    });
  },

  postRemoveVid(req: Request, res: Response): void {
    api.removeVideo(req.body.videoID);
    res.redirect('/admin');
  },

  // Privileged version of /api/getVidRange
  async getVidRangeAdmin(req: Request, res: Response): Promise<void> {
    try {
      let start_id = parseInt(req.params.start);
      let end_id = parseInt(req.params.end);

      const smallestID = 1;
      if (start_id < smallestID) start_id = smallestID;
      if (end_id < start_id) end_id = start_id;

      let len = end_id - start_id + 1;
      if (len > 50) len = 50;

      const docs = await Video.find({ _id: { $gte: start_id } }, { _id: 1, videoID: 1, views: 1, errorCount: 1, skips: 1, time: 1, submittedUser: 1 }).sort({ _id: 1 }).limit(len).lean();
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  postCrawlReddit(_req: Request, res: Response): void {
    reddit.crawlReddit();
    res.redirect('/admin');
  },

  // ── Public-submission moderation ────────────────────────────────────────────

  async getSubmissions(req: Request, res: Response): Promise<void> {
    try {
      const pending = await Submission.find({ status: 'pending' }).sort({ time: -1 }).limit(200).lean();
      const recent = await Submission.find({ status: { $in: ['approved', 'rejected'] } }).sort({ time: -1 }).limit(20).lean();
      res.render('admin/submissions', { user: req.user, csrfToken: req.csrfToken!(), pending, recent });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading submissions');
    }
  },

  // Approve a pending submission: add the video, or expand + add the playlist.
  async postApproveSubmission(req: Request, res: Response): Promise<void> {
    try {
      const id = String((req.body && req.body.id) || '');
      const sub = await Submission.findById(id);
      if (sub && sub.status === 'pending') {
        let result: string;
        if (sub.type === 'video') {
          await addVideoPromise(sub.sourceId);
          result = 'added video ' + sub.sourceId;
        } else {
          const count = await addPlaylist(sub.sourceId);
          result = 'added ' + count + ' video(s) from playlist';
        }
        sub.status = 'approved';
        sub.note = result;
        await sub.save();
      }
    } catch (err) {
      console.error(err);
    }
    res.redirect('/admin/submissions');
  },

  // Reject a pending submission (kept for the audit trail, not deleted).
  async postRejectSubmission(req: Request, res: Response): Promise<void> {
    try {
      const id = String((req.body && req.body.id) || '');
      await Submission.updateOne({ _id: id, status: 'pending' }, { $set: { status: 'rejected', note: 'rejected by admin' } });
    } catch (err) {
      console.error(err);
    }
    res.redirect('/admin/submissions');
  },

  // ── Engagement stats (see models/analyticsevent.ts) ─────────────────────────

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // One doc per session: whether it ever loaded '/' (page_view), how many
      // videos it played, and the last video it played (a proxy for "the
      // video the session ended on" — there's no real signal for tab-close).
      const perSession: any[] = await AnalyticsEvent.aggregate([
        { $sort: { time: 1 } },
        {
          $group: {
            _id: '$sessionID',
            hasPageView: { $max: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
            videoIDs: { $push: { $cond: [{ $eq: ['$type', 'video_played'] }, '$videoID', '$$REMOVE'] } }
          }
        },
        {
          $project: {
            hasPageView: 1,
            videoCount: { $size: '$videoIDs' },
            lastVideoID: { $arrayElemAt: ['$videoIDs', -1] }
          }
        }
      ]);

      const landedSessions = perSession.filter((s) => s.hasPageView === 1);
      const bouncedCount = landedSessions.filter((s) => s.videoCount === 0).length;
      const withVideo = perSession.filter((s) => s.videoCount > 0);
      const totalVideosWatched = withVideo.reduce((sum, s) => sum + s.videoCount, 0);
      const avgVideosWatched = withVideo.length ? totalVideosWatched / withVideo.length : 0;

      const endingCounts = new Map<string, number>();
      withVideo.forEach((s) => {
        if (!s.lastVideoID) return;
        endingCounts.set(s.lastVideoID, (endingCounts.get(s.lastVideoID) || 0) + 1);
      });
      const topEndingVideos = Array.from(endingCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([videoID, count]) => ({ videoID, count }));

      const titles = await lookupTitles(topEndingVideos.map((v) => v.videoID));

      res.render('admin/stats', {
        user: req.user,
        landedCount: landedSessions.length,
        bouncedCount,
        bounceRate: landedSessions.length ? (bouncedCount / landedSessions.length * 100) : 0,
        watchedSessionCount: withVideo.length,
        avgVideosWatched,
        topEndingVideos: topEndingVideos.map((v) => ({ ...v, title: titles[v.videoID] || null }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading stats');
    }
  }
};

export = admin;
