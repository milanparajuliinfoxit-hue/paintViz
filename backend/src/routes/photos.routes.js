const express = require('express');
const photosCtrl = require('../controllers/photos.controller');
const surfacesCtrl = require('../controllers/surfaces.controller');

const router = express.Router();

router.put('/reorder', photosCtrl.reorder);
router.post('/bulk-delete', photosCtrl.bulkDelete);
router.delete('/:id', photosCtrl.remove);

// Nested: surfaces for a given photo
router.get('/:id/surfaces', surfacesCtrl.listForPhoto);
router.post('/:id/surfaces', surfacesCtrl.create);

module.exports = router;
