'use strict';
var express = require('express');
var router = express.Router();
var admin = require('../../controllers/admin');
var csrfProtection = require('../../config/csrf');

// any url at /admin/ requires an admin user
router.all('*', admin.needsAdmin);
router.get('/', csrfProtection, admin.getIndex);
router.post('/submit', csrfProtection, admin.postSubmitVid);
router.post('/remove', csrfProtection, admin.postRemoveVid);
router.get('/getvidrange/:start/:end', admin.getVidRangeAdmin);
router.get('/crawlreddit', admin.postCrawlReddit);

module.exports = router;
