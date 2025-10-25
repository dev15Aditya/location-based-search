const express = require('express');
const router = express.Router();
const { autocomplete, autocompleteAll, autocompleteUnified } = require('../controllers/autocompleteController');

// Autocomplete for tags only
router.get('/tags', autocomplete);

// Autocomplete for both tags and offer names
router.get('/all', autocompleteAll);

// Unified autocomplete for dishes, stores, and cuisines
router.get('/unified', autocompleteUnified);

module.exports = router;
