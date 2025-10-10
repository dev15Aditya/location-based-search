const Business = require('../models/Business');

const testAtlasSearch = async (req, res) => {
  try {
    const { query = 'Nike' } = req.query;
    
    console.log('Testing Atlas Search for:', query);
    
    const results = {
      query,
      tests: {}
    };

    // Test 1: Basic Atlas Search
    try {
      const basicAtlas = await Business.aggregate([
        {
          $search: {
            index: 'business_search',
            text: {
              query: query,
              path: 'businessName'
            }
          }
        },
        { $limit: 5 },
        {
          $addFields: {
            searchScore: { $meta: 'searchScore' }
          }
        }
      ]);
      results.tests.basicAtlasSearch = {
        success: true,
        count: basicAtlas.length,
        results: basicAtlas.map(r => ({
          businessName: r.businessName,
          active: r.active,
          searchScore: r.searchScore
        }))
      };
    } catch (error) {
      results.tests.basicAtlasSearch = {
        success: false,
        error: error.message
      };
    }

    // Test 2: Atlas Search with wildcard
    try {
      const wildcardAtlas = await Business.aggregate([
        {
          $search: {
            index: 'business_search',
            wildcard: {
              query: `*${query}*`,
              path: 'businessName'
            }
          }
        },
        { $limit: 5 }
      ]);
      results.tests.wildcardAtlasSearch = {
        success: true,
        count: wildcardAtlas.length,
        results: wildcardAtlas.map(r => ({ businessName: r.businessName, active: r.active }))
      };
    } catch (error) {
      results.tests.wildcardAtlasSearch = {
        success: false,
        error: error.message
      };
    }

    // Test 3: Check if index exists by trying different index names
    const indexNames = ['business_search', 'default', 'businesses_search'];
    for (const indexName of indexNames) {
      try {
        const indexTest = await Business.aggregate([
          {
            $search: {
              index: indexName,
              text: {
                query: query,
                path: 'businessName'
              }
            }
          },
          { $limit: 1 }
        ]);
        results.tests[`index_${indexName}`] = {
          success: true,
          count: indexTest.length
        };
      } catch (error) {
        results.tests[`index_${indexName}`] = {
          success: false,
          error: error.message
        };
      }
    }

    // Test 4: Regular MongoDB text search (if text index exists)
    try {
      const textSearch = await Business.find({
        $text: { $search: query }
      }).limit(5);
      results.tests.mongoTextSearch = {
        success: true,
        count: textSearch.length,
        results: textSearch.map(r => ({ businessName: r.businessName, active: r.active }))
      };
    } catch (error) {
      results.tests.mongoTextSearch = {
        success: false,
        error: error.message
      };
    }

    // Test 5: Basic regex search (should always work)
    const regexSearch = await Business.find({
      businessName: { $regex: query, $options: 'i' }
    }).limit(5);
    results.tests.regexSearch = {
      success: true,
      count: regexSearch.length,
      results: regexSearch.map(r => ({ businessName: r.businessName, active: r.active }))
    };

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Atlas test error:', error);
    res.status(500).json({ 
      error: 'Atlas test failed',
      message: error.message
    });
  }
};

module.exports = {
  testAtlasSearch
};