var express = require('express');
var router = express.Router();
var api = require('../../controllers/api');

router.get('/getrandomvid', api.getRandomVid);
router.get('/getvidrange/:start/:end', api.getVidRange);
router.get('/getnumvids', api.getNumVids);
router.get('/gethistory', api.getVideoHistory);
router.get('/getVidInfo/:videoID/', api.getVideoInfo);

module.exports = router;
