const express = require('express');
const { searchFood } = require('../controllers/searchController');

const router = express.Router();

// Universal search endpoint
router.get('/', searchFood);

module.exports = router;