const express = require('express');
const projectsCtrl = require('../controllers/projects.controller');
const photosCtrl = require('../controllers/photos.controller');
const surfacesCtrl = require('../controllers/surfaces.controller');
const visualizationsCtrl = require('../controllers/visualizations.controller');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/', projectsCtrl.list);
router.post('/', projectsCtrl.create);
router.get('/:id', projectsCtrl.getOne);
router.put('/:id', projectsCtrl.update);
router.delete('/:id', projectsCtrl.remove);

// Nested: photos
router.post('/:id/photos', upload.array('photos', 20), photosCtrl.upload);

// Nested: visualizations (combos)
router.get('/:id/visualizations', visualizationsCtrl.listForProject);
router.post('/:id/visualizations', visualizationsCtrl.create);

module.exports = router;
