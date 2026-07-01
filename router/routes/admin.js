'use strict';
var express = require('express');
var router = express.Router();
var admin = require('../../controllers/admin');
var csrf = require('../../config/csrf');

// any url at /admin/ requires an admin user
router.all('*', admin.needsAdmin);
router.get('/', csrf.attachToken, admin.getIndex);
router.post('/submit', csrf.csrfProtection, admin.postSubmitVid);
router.post('/remove', csrf.csrfProtection, admin.postRemoveVid);
router.get('/getvidrange/:start/:end', admin.getVidRangeAdmin);
router.get('/crawlreddit', admin.postCrawlReddit);
router.get('/submissions', csrf.attachToken, admin.getSubmissions);
router.post('/submissions/approve', csrf.csrfProtection, admin.postApproveSubmission);
router.post('/submissions/reject', csrf.csrfProtection, admin.postRejectSubmission);

module.exports = router;
