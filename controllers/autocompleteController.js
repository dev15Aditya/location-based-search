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

const autocompleteSearch = async (req, res) => {
  try {
    // const { lat, lng, query, limit = 10, maxDistance = 5 } = req.query;
    const { query } = req.query;

    // if (!query || !lat || !lng) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Missing lat, lng, or query",
    //   });
    // }

    const limit = 10;
    // const query = "Hawaiian"
    const lat = 47.5617161;
    const lng = -122.3779385;
    const maxDistanceMeters = 5 * 1609.34;


    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const limitNum = parseInt(limit);
    // const maxDistanceMeters = parseInt(maxDistance) * 1609.34; // Convert miles to meters

    const SearchIndex = require('../models/SearchIndex');

    const respo = await SearchIndex.find();
    // console.log("Res---->>> ", respo)

    // Perform autocomplete search with geo filtering
    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: 'autocomplete_geo_index',
    //       compound: {
    //         must: [
    //           {
    //             geoWithin: {
    //               circle: {
    //                 center: {
    //                   type: 'Point',
    //                   coordinates: [lngNum, latNum]
    //                 },
    //                 radius: maxDistanceMeters
    //               },
    //               path: 'location.coordinates'
    //             }
    //           }
    //         ],
    //         should: [
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: 'businessName',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 3 } }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: 'dishes.name',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           },
    //           {
    //             text: {
    //               query: query,
    //               path: 'cuisine',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           }
    //         ],
    //         // filter: [
    //         //   {
    //         //     geoWithin: {
    //         //       path: 'location.coordinates',
    //         //       circle: {
    //         //         center: {
    //         //           type: 'Point',
    //         //           coordinates: [lngNum, latNum],
    //         //         },
    //         //         radius: 16090.34,
    //         //       },
    //         //     },
    //         //   },
    //         // ],
 
    //       }
    //     }
    //   },
    //   { $limit: 100 },
    //   // {
    //   //   $addFields: {
    //   //     searchScore: { $meta: 'searchScore' }
    //   //   }
    //   // }
    // ]);

    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: "autocomplete_geo_index",
    //       compound: {
    //         should: [
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "businessName",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "dishes.name",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 }
    //             }
    //           }
    //         ]
    //       }
    //     }
    //   },
    //   { $addFields: { score: { $meta: "searchScore" } } },
    //   { $limit: 10 }
    // ]);

    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: "autocomplete_geo_index",
    //       compound: {
    //         must: [
    //           {
    //             geoWithin: {
    //               circle: {
    //                 center: {
    //                   type: "Point",
    //                   coordinates: [lngNum, latNum]
    //                 },
    //                 radius: maxDistanceMeters
    //               },
    //               path: "location.coordinates"
    //             }
    //           }
    //         ],
    //         should: [
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "businessName",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 3 } }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "dishes.name",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           },
    //           {
    //             text: {
    //               query: query,
    //               path: "cuisine",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 1.5 } }
    //             }
    //           }
    //         ],
    //         minimumShouldMatch: 1
    //       }
    //     }
    //   },
    //   { $addFields: { searchScore: { $meta: "searchScore" } } },
    //   { $limit: 10 }
    // ]);

    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: 'autocomplete_geo_index',
    //       compound: {
    //         should: [
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: 'businessName',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 3 } }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: 'dishes.name',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           },
    //           {
    //             text: {
    //               query: query,
    //               path: 'cuisine',
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           }
    //         ],
    //         filter: [
    //           {
    //             geoWithin: {
    //               path: 'location.coordinates',
    //               circle: {
    //                 center: {
    //                   type: 'Point',
    //                   coordinates: [lngNum, latNum],
    //                 },
    //                 radius: 16090.34,
    //               },
    //             },
    //           },
    //         ],
    //       }
    //     }
    //   },
    //   { $limit: 100 }
    // ]);
    

    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: "autocomplete_geo_index",
    //       compound: {
    //         should: [
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "businessName",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 3 } }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query: query,
    //               path: "dishes.name",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           },
    //           {
    //             text: {
    //               query: query,
    //               path: "cuisine",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 1.5 } }
    //             }
    //           }
    //         ],
    //         minimumShouldMatch: 1
    //       }
    //     }
    //   },
    //   { $addFields: { searchScore: { $meta: "searchScore" } } },
    //   {
    //     $match: {
    //       'location.coordinates': {
    //         $geoWithin: {
    //           $centerSphere: [
    //             [lngNum, latNum],
    //             maxDistanceMeters / 6378100
    //           ]
    //         }
    //       }
    //     }
    //   },
    //   { $limit: 10 }
    // ]);

    const preFacetLimit = 10;

    const radius = maxDistanceMeters / 6378100;


    // const results = await SearchIndex.aggregate([
    //   {
    //     $search: {
    //       index: 'autocomplete_geo_index',
    //       compound: {
    //         should: [
    //           {
    //             autocomplete: {
    //               query,
    //               path: "businessName",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 3 } }
    //             }
    //           },
    //           {
    //             autocomplete: {
    //               query,
    //               path: "dishes.name",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 2 } }
    //             }
    //           },
    //           {
    //             text: {
    //               query,
    //               path: "cuisine",
    //               fuzzy: { maxEdits: 1, prefixLength: 2 },
    //               score: { boost: { value: 1.5 } }
    //             }
    //           }
    //         ],
    //         minimumShouldMatch: 1
    //       }
    //     }
    //   },

    //   // 2) expose searchScore
    //   { $addFields: { searchScore: { $meta: "searchScore" } } },

    //   // 3) geo filter
    //   {
    //     $match: {
    //       "location.coordinates": {
    //         $geoWithin: {
    //           $centerSphere: [[lngNum, latNum], radius]
    //         }
    //       }
    //     }
    //   },

    //   // 4) project only required fields to reduce memory before facet/unwind
    //   {
    //     $project: {
    //       _id: 0,
    //       businessId: 1,
    //       businessName: 1,
    //       businessLogoUrl: 1,
    //       slug: 1,
    //       location: 1,
    //       searchScore: 1,
    //       // keep only necessary dish fields
    //       dishes: {
    //         $map: {
    //           input: { $ifNull: ["$dishes", []] },
    //           as: "d",
    //           in: {
    //             name: "$$d.name",
    //             // dishId: "$$d.dishId",
    //             cuisine: "$$d.cuisine",
    //             // category: "$$d.category",
    //             // actualPrice: "$$d.actualPrice",
    //             // offerPrice: "$$d.offerPrice"
    //           }
    //         }
    //       },
    //       cuisine: 1
    //     }
    //   },

    //   // 5) sort by score so grouping with $first keeps the top scoring doc
    //   { $sort: { searchScore: -1 } },

    //   // 6) small pre-limit to reduce facet work (tune preFacetLimit)
    //   { $limit: preFacetLimit },

    //   // 7) facet into three result sets
    //   {
    //     $facet: {
    //       // Unique businesses (group by businessId, highest score first because we sorted)
    //       businesses: [
    //         {
    //           $group: {
    //             _id: "$businessId",
    //             doc: { $first: "$$ROOT" },    // highest score doc for this business
    //             score: { $first: "$searchScore" }
    //           }
    //         },
    //         { $replaceRoot: { newRoot: { $mergeObjects: ["$doc", { score: "$score" }] } } },
    //         {
    //           $project: {
    //             _id: 0,
    //             businessId: 1,
    //             businessName: 1,
    //             // businessLogoUrl: 1,
    //             // slug: 1,
    //             // location: 1,
    //             // score: 1
    //           }
    //         },
    //         { $sort: { score: -1 } },
    //         { $limit: limitNum }
    //       ],

    //       // Dishes (unwind & dedupe by dishId; keep the occurrence with highest searchScore)
    //       dishes: [
    //         { $unwind: "$dishes" },
    //         // input is already sorted by searchScore globally, but repeat sort to be safe
    //         { $sort: { searchScore: -1 } },
    //         {
    //           $group: {
    //             _id: "$dishes.dishId",
    //             doc: { $first: "$$ROOT" },      // doc containing the highest-scoring occurrence
    //             score: { $first: "$searchScore" }
    //           }
    //         },
    //         {
    //           $project: {
    //             _id: 0,
    //             score: 1,
    //             name: "$doc.dishes.name",
    //             // dishId: "$doc.dishes.dishId",
    //             cuisine: "$doc.dishes.cuisine",
    //             // category: "$doc.dishes.category",
    //             // actualPrice: "$doc.dishes.actualPrice",
    //             // offerPrice: "$doc.dishes.offerPrice",
    //             // businessName: "$doc.businessName",
    //             // businessId: "$doc.businessId",
    //             // businessLogoUrl: "$doc.businessLogoUrl",
    //             // slug: "$doc.slug",
    //             // location: "$doc.location"
    //           }
    //         },
    //         { $sort: { score: -1 } },
    //         { $limit: limitNum }
    //       ],

    //       // Cuisines (unwind cuisine array, dedupe by cuisine string)
    //       cuisines: [
    //         { $unwind: { path: "$cuisine", preserveNullAndEmptyArrays: false } },
    //         { $sort: { searchScore: -1 } },
    //         {
    //           $group: {
    //             _id: "$cuisine",
    //             name: { $first: "$cuisine" },
    //             score: { $first: "$searchScore" }
    //           }
    //         },
    //         { $sort: { score: -1 } },
    //         { $limit: limitNum },
    //         { $project: { _id: 0, name: 1, score: 1 } }
    //       ]
    //     }
    //   }
    // ])

    // console.log("RESULT--->>", JSON.stringify(results))

    // const geoOnlyResults = await SearchIndex.find({
    //   'location.coordinates': {
    //     $near: {
    //       $geometry: {
    //         type: "Point",
    //         coordinates: [lngNum, latNum]
    //       },
    //       $maxDistance: maxDistanceMeters
    //     }
    //   }
    // }).limit(5);

    // console.log("Geo-only results count:", geoOnlyResults.length);
    // console.log("First result:", geoOnlyResults[0]?.businessName);


    const results = await SearchIndex.aggregate([
      {
        $search: {
          index: "autocomplete_geo_index",
          compound: {
            must: [
              {
                geoWithin: {
                  circle: {
                    center: {
                      type: "Point",
                      coordinates: [lngNum, latNum]
                    },
                    radius: maxDistanceMeters
                  },
                  path: "location"
                }
              }
            ],
            should: [
              {
                autocomplete: {
                  query,
                  path: "businessName",
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                  score: { boost: { value: 4 } }
                }
              },
              {
                autocomplete: {
                  query,
                  path: "dishes.name",
                  fuzzy: { maxEdits: 1, prefixLength: 1 },
                  score: { boost: { value: 3 } }
                }
              },
              {
                text: {
                  query,
                  path: "cuisine",
                  fuzzy: { maxEdits: 1 },
                  score: { boost: { value: 1.5 } }
                }
              }
            ],
            minimumShouldMatch: 1
          },
          returnStoredSource: false,
          scoreDetails: false
        }
      },

      // expose searchScore + geoDistance
      {
        $addFields: {
          searchScore: { $meta: "searchScore" }
        }
      },

      // lightweight projection before heavy ops
      {
        $project: {
          _id: 0,
          businessId: 1,
          businessName: 1,
          businessLogoUrl: 1,
          slug: 1,
          location: 1,
          searchScore: 1,
          distanceMeters: 1,
          dishes: {
            $map: {
              input: { $ifNull: ["$dishes", []] },
              as: "d",
              in: {
                name: "$$d.name",
                dishId: "$$d.dishId",
                cuisine: "$$d.cuisine"
              }
            }
          },
          cuisine: 1
        }
      },

      // pre-sort and limit to reduce memory cost
      { $sort: { searchScore: -1 } },
      { $limit: preFacetLimit },

      // facets for businesses, dishes, cuisines
      {
        $facet: {
          businesses: [
            {
              $group: {
                _id: "$businessId",
                doc: { $first: "$$ROOT" },
                score: { $first: "$searchScore" }
              }
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: ["$doc", { score: "$score" }]
                }
              }
            },
            {
              $project: {
                _id: 0,
                businessId: 1,
                businessName: 1,
                businessLogoUrl: 1,
                slug: 1,
                location: 1,
                score: 1,
                distanceMeters: 1
              }
            },
            { $sort: { score: -1 } },
            { $limit: limitNum }
          ],

          dishes: [
            { $unwind: "$dishes" },
            { $sort: { searchScore: -1 } },
            {
              $group: {
                _id: "$dishes.dishId",
                doc: { $first: "$$ROOT" },
                score: { $first: "$searchScore" }
              }
            },
            {
              $project: {
                _id: 0,
                score: 1,
                name: "$doc.dishes.name",
                cuisine: "$doc.dishes.cuisine",
                businessName: "$doc.businessName",
                businessId: "$doc.businessId",
                distanceMeters: "$doc.distanceMeters"
              }
            },
            { $sort: { score: -1 } },
            { $limit: limitNum }
          ],

          cuisines: [
            { $unwind: { path: "$cuisine", preserveNullAndEmptyArrays: false } },
            { $sort: { searchScore: -1 } },
            {
              $group: {
                _id: "$cuisine",
                name: { $first: "$cuisine" },
                score: { $first: "$searchScore" }
              }
            },
            { $sort: { score: -1 } },
            { $limit: limitNum },
            { $project: { _id: 0, name: 1, score: 1 } }
          ]
        }
      }
    ]);


    const businessMap = new Map();
    const dishMap = new Map();
    const cuisineMap = new Map();
    const queryLower = query.toLowerCase();

    results.forEach(doc => {
      const score = doc.searchScore;

      // Check if business name matches
      if (doc.businessName) {
        const nameLower = doc.businessName.toLowerCase();
        if (nameLower.includes(queryLower)) {
          let businessScore = score * 3;
          if (nameLower === queryLower) businessScore += 100;
          else if (nameLower.startsWith(queryLower)) businessScore += 50;

          if (!businessMap.has(doc.businessName) || businessMap.get(doc.businessName).score < businessScore) {
            businessMap.set(doc.businessName, {
              name: doc.businessName,
              businessId: doc.businessId,
              logoUrl: doc.businessLogoUrl,
              slug: doc.slug,
              location: doc.location,
            });
          }
        }
      }

      // Check dishes
      if (doc.dishes && Array.isArray(doc.dishes)) {
        doc.dishes.forEach(dish => {
          if (dish.name) {
            const dishLower = dish.name.toLowerCase();
            if (dishLower.includes(queryLower)) {
              let dishScore = score * 2;
              if (dishLower === queryLower) dishScore += 100;
              else if (dishLower.startsWith(queryLower)) dishScore += 50;

              const dishKey = `${dish.name}_${dish.dishId}`;
              if (!dishMap.has(dishKey) || dishMap.get(dishKey).score < dishScore) {
                dishMap.set(dishKey, {
                  name: dish.name,
                  dishId: dish.dishId,
                  cuisine: dish.cuisine,
                  category: dish.category,
                  actualPrice: dish.actualPrice,
                  offerPrice: dish.offerPrice,
                  businessName: doc.businessName,
                  businessId: doc.businessId,
                  score: dishScore
                });
              }
            }
          }
        });
      }

      // Check cuisines
      if (doc.cuisine && Array.isArray(doc.cuisine)) {
        doc.cuisine.forEach(cuisine => {
          const cuisineLower = cuisine.toLowerCase();
          if (cuisineLower.includes(queryLower)) {
            let cuisineScore = score * 2;
            if (cuisineLower === queryLower) cuisineScore += 100;
            else if (cuisineLower.startsWith(queryLower)) cuisineScore += 50;

            if (!cuisineMap.has(cuisine) || cuisineMap.get(cuisine).score < cuisineScore) {
              cuisineMap.set(cuisine, {
                name: cuisine,
                score: cuisineScore
              });
            }
          }
        });
      }
    });

    // Convert maps to sorted arrays
    const businesses = Array.from(businessMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limitNum)
      .map(({ score, ...rest }) => rest);

    const dishes = Array.from(dishMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limitNum)
      .map(({ score, ...rest }) => rest);

    const cuisines = Array.from(cuisineMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limitNum)
      .map(({ score, ...rest }) => rest);

    res.json({
      success: true,
      query,
      // location: { lat: latNum, lng: lngNum },
      // maxDistance: `${maxDistance} miles`,
      results
      // results: {
      //   business: businesses,
      //   dish: dishes,
      //   cuisine: cuisines
      // }
    });

  } catch (error) {
    console.error("Autocomplete Search Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  autocomplete,
  autocompleteAll,
  autocompleteUnified,
  autocompleteSearch
};
