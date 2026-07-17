import express from 'express';
import api from '../../controllers/api';

const router = express.Router();

router.get('/getrandomvid', api.getRandomVid);
router.get('/getvidrange/:start/:end', api.getVidRange);
router.get('/getnumvids', api.getNumVids);
router.get('/gethistory', api.getVideoHistory);
router.get('/getVidInfo/:videoID/', api.getVideoInfo);
router.get('/getvidinfobatch', api.getVideoInfoBatch);
router.get('/trackvideoplay/:videoID', api.trackVideoPlay);

export = router;
