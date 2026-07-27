const express = require('express');
const photosCtrl = require('../controllers/photos.controller');
const removalsCtrl = require('../controllers/removals.controller');
const surfacesCtrl = require('../controllers/surfaces.controller');

const router = express.Router();

router.put('/reorder', photosCtrl.reorder);
router.post('/bulk-delete', photosCtrl.bulkDelete);
router.delete('/:id', photosCtrl.remove);

// Nested: surfaces for a given photo
router.get('/:id/surfaces', surfacesCtrl.listForPhoto);
router.post('/:id/surfaces', surfacesCtrl.create);

// Cleanup: segmentation and removal jobs
router.post('/:id/segment-point', removalsCtrl.segmentPoint);
router.post('/:id/mask/refine', removalsCtrl.refineMask);
router.post('/:id/removal-jobs', removalsCtrl.createJob);
router.get('/:id/removal-jobs', removalsCtrl.listJobsForPhoto);

module.exports = router;
