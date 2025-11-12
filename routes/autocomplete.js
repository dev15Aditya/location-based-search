const express = require('express');
const router = express.Router();
const { autocomplete, autocompleteAll, autocompleteUnified, autocompleteSearch } = require('../controllers/autocompleteController');

// Autocomplete for tags only
router.get('/tags', autocomplete);

// Autocomplete for both tags and offer names
router.get('/all', autocompleteAll);

// Unified autocomplete for dishes, stores, and cuisines
router.get('/unified', autocompleteUnified);

// Geo-based autocomplete search
router.get('/search', autocompleteSearch);

module.exports = router;
