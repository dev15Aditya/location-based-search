const express = require('express');
const { testSearch } = require('../controllers/testController');

const router = express.Router();

// Test search endpoint
router.get('/', testSearch);

module.exports = router;