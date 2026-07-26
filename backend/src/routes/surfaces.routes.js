const express = require('express');
const ctrl = require('../controllers/surfaces.controller');

const router = express.Router();

router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
