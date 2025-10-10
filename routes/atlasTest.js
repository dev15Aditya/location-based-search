const express = require('express');
const { testAtlasSearch } = require('../controllers/atlasTestController');

const router = express.Router();

// Atlas Search test endpoint
router.get('/', testAtlasSearch);

module.exports = router;