const express = require('express');
const ctrl = require('../controllers/colors.controller');
const { excelUpload } = require('../middleware/upload');

const router = express.Router();

router.get('/brands', ctrl.listBrands);
router.get('/', ctrl.list);
router.post('/bulk-delete', ctrl.bulkDelete);
router.post('/bulk-deactivate', ctrl.bulkDeactivate);
router.post('/import', excelUpload.single('file'), ctrl.importExcel);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
