const Deal = require('../models/Deal');
const Business = require('../models/Business');

/**
 * Autocomplete API for tags and offer names
 * Returns unique tags/terms with highest scores
 */
const autocomplete = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    // Search for deals matching the query in tags and offerName
    const results = await Deal.aggregate([
      {
        $search: {
          index: 'foodDeals',
          autocomplete: {
            query: query,
            path: 'tags',
            fuzzy: {
              maxEdits: 1,
              prefixLength: 2
            }
          }
        }
      },
      {
        $limit: 100 // Get more results to extract unique tags
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' }
        }
      },
      {
        $project: {
          tags: 1,
          searchScore: 1
        }
      }
    ]);

    // Extract and score individual tags
    const tagScores = new Map();

    results.forEach(deal => {
      if (deal.tags && Array.isArray(deal.tags)) {
        deal.tags.forEach(tag => {
          const tagLower = tag.toLowerCase();
          const queryLower = query.toLowerCase();

          if (tagLower.includes(queryLower)) {
            let score = deal.searchScore;

            if (tagLower === queryLower) {
              score += 100;
            } else if (tagLower.startsWith(queryLower)) {
              score += 50;
            }

            // Keep highest score for each tag
            if (!tagScores.has(tag) || tagScores.get(tag) < score) {
              tagScores.set(tag, score);
            }
          }
        });
      }
    });

    // Convert to array and sort by score
    const suggestions = Array.from(tagScores.entries())
      .map(([tag, score]) => ({ tag, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit))
      .map(item => item.tag);

    res.json({
      success: true,
      query,
      suggestions
    });

  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      success: false,
      error: 'Autocomplete failed',
      message: error.message
    });
  }
};

/**
 * Autocomplete for both tags and offer names
 * Returns combined suggestions
 */
const autocompleteAll = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    // Search both tags and offerName
    const results = await Deal.aggregate([
      {
        $search: {
          index: 'foodDeals',
          compound: {
            should: [
              {
                autocomplete: {
                  query: query,
                  path: 'tags',
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 2
                  },
                  // score: { boost: { value: 2 } }
                }
              },
              {
                autocomplete: {
                  query: query,
                  path: 'offerName',
                  fuzzy: {
                    maxEdits: 2,
                    prefixLength: 2
                  },
                  score: { boost: { value: 2 } }
                }
              }
            ]
          }
        }
      },
      {
        $limit: 100
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' }
        }
      },
      {
        $project: {
          tags: 1,
          offerName: 1,
          searchScore: 1
        }
      }
    ]);

    const suggestionScores = new Map();
    const queryLower = query.toLowerCase();

    results.forEach(deal => {
      // Process tags
      // if (deal.tags && Array.isArray(deal.tags)) {
      //   deal.tags.forEach(tag => {
      //     const tagLower = tag.toLowerCase();
      //     if (tagLower.includes(queryLower)) {
      //       let score = deal.searchScore * 2; // Tags get higher weight

      //       if (tagLower === queryLower) {
      //         score += 100;
      //       } else if (tagLower.startsWith(queryLower)) {
      //         score += 50;
      //       }

      //       if (!suggestionScores.has(tag) || suggestionScores.get(tag) < score) {
      //         suggestionScores.set(tag, score);
      //       }
      //     }
      //   });
      // }

      // Process offerName
      if (deal.offerName) {
        const offerLower = deal.offerName.toLowerCase();
        if (offerLower.includes(queryLower)) {
          let score = deal.searchScore;

          if (offerLower === queryLower) {
            score += 0.25;
          } else if (offerLower.startsWith(queryLower)) {
            score += 0.15;
          }

          if (!suggestionScores.has(deal.offerName) || suggestionScores.get(deal.offerName) < score) {
            suggestionScores.set(deal.offerName, score);
          }
        }
      }
    });

    // Sort and return top suggestions
    const suggestions = Array.from(suggestionScores.entries())
      .map(([text, score]) => ({ text, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit))
      .map(item => item.text);

    res.json({
      success: true,
      query,
      suggestions
    });

  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      success: false,
      error: 'Autocomplete failed',
      message: error.message
    });
  }
};

/**
 * Unified autocomplete for dishes, stores, and cuisines
 * Searches both collections and returns matching data
 */
const autocompleteUnified = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json({
        success: true,
        suggestions: {
          dishes: [],
          stores: [],
          cuisines: []
        }
      });
    }

    const queryLower = query.toLowerCase();
    const suggestions = {
      dishes: new Map(),
      stores: new Map(),
      cuisines: new Map()
    };

    // Search deals using foodDeals index
    // Only has: offerName (autocomplete), tags (autocomplete)
    const dealResults = await Deal.aggregate([
      {
        $search: {
          index: 'foodDeals',
          compound: {
            should: [
              {
                autocomplete: {
                  query: query,
                  path: 'tags',
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                  score: { boost: { value: 3 } }
                }
              },
              {
                autocomplete: {
                  query: query,
                  path: 'offerName',
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                  score: { boost: { value: 2 } }
                }
              }
            ]
          }
        }
      },
      { $limit: 100 },
      { $addFields: { searchScore: { $meta: 'searchScore' } } },
      { $project: { tags: 1, offerName: 1, searchScore: 1 } }
    ]);

    // Process deal results - extract dishes (tags + offerName)
    dealResults.forEach(deal => {
      if (deal.tags && Array.isArray(deal.tags)) {
        deal.tags.forEach(tag => {
          const tagLower = tag.toLowerCase();
          if (tagLower.includes(queryLower)) {
            let score = deal.searchScore * 3;
            if (tagLower === queryLower) score += 0.25;
            else if (tagLower.startsWith(queryLower)) score += 0.15;

            if (!suggestions.dishes.has(tag) || suggestions.dishes.get(tag) < score) {
              suggestions.dishes.set(tag, score);
            }
          }
        });
      }

      if (deal.offerName) {
        const offerLower = deal.offerName.toLowerCase();
        if (offerLower.includes(queryLower)) {
          let score = deal.searchScore * 2;
          if (offerLower === queryLower) score += 0.25;
          else if (offerLower.startsWith(queryLower)) score += 0.15;

          if (!suggestions.dishes.has(deal.offerName) || suggestions.dishes.get(deal.offerName) < score) {
            suggestions.dishes.set(deal.offerName, score);
          }
        }
      }
    });

    // Search businesses using StoreTag index
    // Has: businessName, tags, filters.course, filters.cuisine, filters.dietaryPreferences
    const businessResults = await Business.aggregate([
      {
        $search: {
          index: 'business_search',
          compound: {
            should: [
              {
                autocomplete: {
                  query: query,
                  path: 'businessName',
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                  score: { boost: { value: 3 } }
                }
              },
              {
                autocomplete: {
                  query: query,
                  path: 'tags',
                  fuzzy: { maxEdits: 1, prefixLength: 2 }
                }
              },
              // {
              //   autocomplete: {
              //     query: query,
              //     path: 'filters.cuisine',
              //     fuzzy: { maxEdits: 1, prefixLength: 2 },
              //     score: { boost: { value: 2 } }
              //   }
              // },
              // {
              //   autocomplete: {
              //     query: query,
              //     path: 'filters.course',
              //     fuzzy: { maxEdits: 1, prefixLength: 2 }
              //   }
              // }
            ]
          }
        }
      },
      { $limit: 50 },
      { $addFields: { searchScore: { $meta: 'searchScore' } } },
      { $project: { businessName: 1, tags: 1, filters: 1, searchScore: 1 } }
    ]);

    // Process business results
    businessResults.forEach(business => {
      // Extract store names
      if (business.businessName) {
        const nameLower = business.businessName.toLowerCase();
        if (nameLower.includes(queryLower)) {
          let score = business.searchScore * 3;
          if (nameLower === queryLower) score += 0.25;
          else if (nameLower.startsWith(queryLower)) score += 0.15;

          if (!suggestions.stores.has(business.businessName) || suggestions.stores.get(business.businessName) < score) {
            suggestions.stores.set(business.businessName, score);
          }
        }
      }

      // Extract cuisines from filters.cuisine
      if (business.filters && business.filters.cuisine) {
        const cuisines = Array.isArray(business.filters.cuisine)
          ? business.filters.cuisine
          : [business.filters.cuisine];

        cuisines.forEach(cuisine => {
          if (cuisine) {
            const cuisineLower = cuisine.toLowerCase();
            if (cuisineLower.includes(queryLower)) {
              let score = business.searchScore * 2;
              if (cuisineLower === queryLower) score += 0.25;
              else if (cuisineLower.startsWith(queryLower)) score += 0.15;

              if (!suggestions.cuisines.has(cuisine) || suggestions.cuisines.get(cuisine) < score) {
                suggestions.cuisines.set(cuisine, score);
              }
            }
          }
        });
      }
    });

    // Convert to arrays and sort
    const limitNum = parseInt(limit);
    const response = {
      success: true,
      query,
      suggestions: {
        dishes: Array.from(suggestions.dishes.entries())
          .map(([text, score]) => ({ text, score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map(item => item.text),
        stores: Array.from(suggestions.stores.entries())
          .map(([text, score]) => ({ text, score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map(item => item.text),
        cuisines: Array.from(suggestions.cuisines.entries())
          .map(([text, score]) => ({ text, score }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map(item => item.text)
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Unified autocomplete error:', error);
    res.status(500).json({
      success: false,
      error: 'Autocomplete failed',
      message: error.message
    });
  }
};

module.exports = {
  autocomplete,
  autocompleteAll,
  autocompleteUnified
};
