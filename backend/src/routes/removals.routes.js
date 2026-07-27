const express = require('express');
const removalsCtrl = require('../controllers/removals.controller');

const router = express.Router();

// Job routes (mounted at /api/removal-jobs)
router.get('/:jobId', removalsCtrl.getJob);
router.post('/:jobId/retry', removalsCtrl.retryJob);

module.exports = router;
