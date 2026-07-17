import passport from 'passport';
import api = require('./api');
import AnalyticsEvent = require('../models/analyticsevent');
import type { Request, Response } from 'express';

const root = {
  getIndex(req: Request, res: Response): void {
    // Fire-and-forget: a page_view marks this session as having landed, so it
    // can be compared against video_played events to measure how many
    // visitors never click "Get Weird".
    AnalyticsEvent.create({ sessionID: req.sessionID, type: 'page_view' }).catch((e: unknown) => { console.log(e); });

    if (!req.session.seenVideos) req.session.seenVideos = [];
    api.randomVideoID(req.session.seenVideos, (err: any, doc: any) => {
      if (err) { res.status(500).send('Database error'); return; }
      let videoID = '';
      if (doc) {
        videoID = doc.videoID;
        req.session.seenVideos!.push(doc.videoID);
      }
      res.render('index', { videoID, user: req.user });
    });
  },

  getLogin(req: Request, res: Response): void {
    res.render('login', { user: req.user, csrfToken: req.csrfToken!() });
  },

  postLogin(req: Request, res: Response): void {
    passport.authenticate('local')(req, res, () => {
      res.redirect('/');
    });
  },

  // Passport 0.6+ made req.logout asynchronous — it now takes a callback.
  getLogout(req: Request, res: Response): void {
    req.logout((err) => {
      if (err) { console.log(err); }
      res.redirect('/');
    });
  },

  getAbout(req: Request, res: Response): void {
    res.render('about', { user: req.user });
  },

  getButWhy(req: Request, res: Response): void {
    res.render('butwhy', { user: req.user });
  },

  getHistory(req: Request, res: Response): void {
    if (req.user) {
      res.render('history', { user: req.user });
    } else {
      res.redirect('/');
    }
  }
};

export = root;
