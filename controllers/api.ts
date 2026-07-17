import Video = require('../models/video');
import Counter = require('../models/counters');
import VideoHistory = require('../models/videohistory');
import BannedVideo = require('../models/bannedvideo');
import AnalyticsEvent = require('../models/analyticsevent');
import { extractVideoId } from '../lib/youtube';
import { shouldTrack } from '../lib/analyticsGate';
import type { Request, Response } from 'express';

type Callback<T = unknown> = (err: unknown, result?: T) => void;

// Exported as a single object so route handlers and tests keep the existing
// `require('../controllers/api')` semantics, and internal cross-calls (e.g.
// getRandomVid -> randomVideoID) go through the object so they remain stubbable.
const api = {
  // Adds a video to the DB. Keeps its callback signature so the tools/* CLIs and
  // routes don't change; the Mongoose calls inside are promise-based. On a new
  // video it calls back with the created doc; on a duplicate/banned video with
  // the plain id string (callers distinguish "added" by checking for .videoID).
  async addVideo(video_url_or_id: string, callback: Callback): Promise<void> {
    const vidID = extractVideoId(video_url_or_id);
    if (!vidID) return callback(new Error('Not a valid YouTube video id or URL: ' + video_url_or_id));
    try {
      const banned = await BannedVideo.findOne({ videoID: vidID });
      if (banned) return callback(null, vidID);

      const existing = await Video.findOne({ videoID: vidID });
      if (existing) return callback(null, vidID);

      const counter = await Counter.findByIdAndUpdate('videos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
      const vid = await Video.create({ videoID: vidID, _id: counter!.seq });
      callback(null, vid);
    } catch (err) {
      console.log(err);
      callback(err);
    }
  },

  async removeVideoNoParse(vidID: string): Promise<void> {
    try {
      const banned = await BannedVideo.findOne({ videoID: vidID });
      if (!banned) {
        const bannedCounter = await Counter.findByIdAndUpdate('bannedvideos', { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
        await BannedVideo.create({ videoID: vidID, _id: bannedCounter!.seq });
      }

      const video = await Video.findOne({ videoID: vidID });
      if (!video) return;
      const __id = video._id;
      const counter = await Counter.findById('videos');
      if (!counter) return;
      // Move the highest-_id video into the freed slot so _id stays contiguous
      // 1..seq (admin tooling and getVidRange rely on this).
      const _video = await Video.findOne({ _id: counter.seq });
      if (!_video) return;
      await video.deleteOne();
      await Video.create({ videoID: _video.videoID, _id: __id });
      await _video.deleteOne();
      counter.seq = counter.seq - 1;
      await counter.save();
    } catch (err) {
      console.error(err);
    }
  },

  removeVideo(video_url_or_id: string): void {
    const vidID = extractVideoId(video_url_or_id);
    if (vidID) {
      api.removeVideoNoParse(vidID);
    }
  },

  // Returns a random video doc not in seenVideoIDs. If all have been seen, resets
  // and retries once so the session can loop the catalog forever.
  randomVideoID(seenVideoIDs: string[], callback: Callback): void {
    Video.aggregate([
      { $match: { videoID: { $nin: seenVideoIDs } } },
      { $sample: { size: 1 } }
    ]).then((docs: any[]) => {
      if (!docs.length) {
        if (seenVideoIDs.length === 0) return callback(null, null); // DB truly empty
        return api.randomVideoID([], callback);                     // exhausted → reset & retry
      }
      const doc = docs[0];
      // Fire-and-forget view bump; failures here must not break playback.
      Video.findByIdAndUpdate(doc._id, { $inc: { views: 1 } }).catch(() => {});
      callback(null, doc);
    }, (err: unknown) => {
      callback(err);
    });
  },

  getRandomVid(req: Request, res: Response): void {
    if (!req.session.seenVideos) req.session.seenVideos = [];
    api.randomVideoID(req.session.seenVideos, (err: any, doc: any) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!doc) return res.status(503).json({ error: 'No videos in database yet' });
      req.session.seenVideos!.push(doc.videoID);
      if (req.user) {
        VideoHistory.create({
          username: req.user.username,
          videoID: doc.videoID,
          userAgent: (req.headers && req.headers['user-agent']) || ''
        }).catch((e: unknown) => { console.log(e); });
      }
      if (shouldTrack(req)) {
        AnalyticsEvent.create({ sessionID: req.sessionID, type: 'video_played', videoID: doc.videoID })
          .catch((e: unknown) => { console.log(e); });
      }
      res.json({ vidID: doc.videoID });
    });
  },

  // Records a video_played event for videos played via a shared /?v=<id>
  // deep link, which the client plays directly without ever calling
  // getRandomVid — without this, deep-linked plays would be invisible to the
  // avg-videos-watched / session-ending-video stats.
  trackVideoPlay(req: Request, res: Response): void {
    const vidID = extractVideoId(req.params.videoID);
    if (vidID && shouldTrack(req)) {
      AnalyticsEvent.create({ sessionID: req.sessionID, type: 'video_played', videoID: vidID })
        .catch((e: unknown) => { console.log(e); });
    }
    res.status(204).end();
  },

  async getVidRange(req: Request, res: Response): Promise<void> {
    try {
      let start_id = parseInt(req.params.start);
      let end_id = parseInt(req.params.end);
      const counter = await Counter.findById('videos');
      if (!counter) { res.json([]); return; }

      const smallestID = 1;
      if (start_id < smallestID) start_id = smallestID;
      if (end_id < start_id) end_id = start_id;

      let len = end_id - start_id + 1;
      if (len > 50) len = 50;

      const docs = await Video.find({ _id: { $gte: start_id } }, { videoID: 1 }).limit(len).lean();
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getVideoHistory(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).send('User is not logged in');
      return;
    }
    try {
      const history = await VideoHistory.find({ username: req.user.username }, { _id: 0, videoID: 1, time: 1, userAgent: 1 }).sort({ time: -1 }).limit(50);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getNumVids(_req: Request, res: Response): Promise<void> {
    try {
      const count = await Counter.findById('videos');
      res.json({ numVids: count ? count.seq : 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async getNumBannedVids(_req: Request, res: Response): Promise<void> {
    try {
      const count = await Counter.findById('bannedvideos');
      res.json({ numBannedVids: count ? count.seq : 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  getVideoInfo(req: Request, res: Response): void {
    const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeAPIKey) {
      res.status(500).json({ error: 'YOUTUBE_API_KEY environment variable is not set' });
      return;
    }
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' +
      encodeURIComponent(req.params.videoID) + '&key=' + youtubeAPIKey;
    fetch(url)
      .then((response) => response.text().then((body) => {
        if (response.ok) return res.send(body);
        return res.status(502).json({ error: 'YouTube API request failed' });
      }))
      .catch((err: any) => {
        res.status(502).json({ error: err.message });
      });
  },

  // Bulk version: fetch info for up to 50 videos in one YouTube API call.
  // Used by the admin panel so loading many rows doesn't hammer /api past its
  // rate limit (?ids=id1,id2,...).
  getVideoInfoBatch(req: Request, res: Response): void {
    const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeAPIKey) {
      res.status(500).json({ error: 'YOUTUBE_API_KEY environment variable is not set' });
      return;
    }
    const ids = String(req.query.ids || '')
      .split(',')
      .filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id))
      .slice(0, 50);
    if (!ids.length) {
      res.json({ items: [] });
      return;
    }
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' +
      ids.map(encodeURIComponent).join(',') + '&key=' + youtubeAPIKey;
    fetch(url)
      .then((response) => response.text().then((body) => {
        if (response.ok) return res.send(body);
        return res.status(502).json({ error: 'YouTube API request failed' });
      }))
      .catch((err: any) => {
        res.status(502).json({ error: err.message });
      });
  }
};

export = api;
