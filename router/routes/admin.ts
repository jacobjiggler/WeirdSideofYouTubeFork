import express from 'express';
import admin from '../../controllers/admin';
import { attachToken, csrfProtection } from '../../config/csrf';

const router = express.Router();

// any url at /admin/ requires an admin user
router.all('*', admin.needsAdmin);
router.get('/', attachToken, admin.getIndex);
router.post('/submit', csrfProtection, admin.postSubmitVid);
router.post('/remove', csrfProtection, admin.postRemoveVid);
router.get('/getvidrange/:start/:end', admin.getVidRangeAdmin);
router.get('/crawlreddit', admin.postCrawlReddit);
router.get('/submissions', attachToken, admin.getSubmissions);
router.post('/submissions/approve', csrfProtection, admin.postApproveSubmission);
router.post('/submissions/reject', csrfProtection, admin.postRejectSubmission);
router.get('/stats', admin.getStats);

export = router;
