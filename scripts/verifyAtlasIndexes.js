require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');
const Deal = require('../models/Deal');
const Location = require('../models/Location');

async function verifyAtlasIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const results = {
      stores: {},
      deals: {},
      locations: {}
    };

    // ========================================
    // 1. VERIFY STORES (BUSINESS) INDEXES
    // ========================================
    console.log('=== STORES COLLECTION (businesses) ===\n');
    
    // Test business_search index
    console.log('Testing business_search index...');
    try {
      const businessResults = await Business.aggregate([
        {
          $search: {
            index: 'business_search',
            text: {
              query: 'Nike',
              path: ['businessName', 'tags']
            }
          }
        },
        { $limit: 3 },
        { $addFields: { searchScore: { $meta: 'searchScore' } } }
      ]);
      results.stores.business_search = {
        status: '✓ FOUND',
        count: businessResults.length,
        sample: businessResults.map(r => ({ 
          businessName: r.businessName, 
          score: r.searchScore 
        }))
      };
      console.log('✓ business_search index: WORKING');
      console.log(`  Found ${businessResults.length} results`);
    } catch (error) {
      results.stores.business_search = {
        status: '✗ ERROR',
        error: error.message
      };
      console.log('✗ business_search index: ERROR');
      console.log(`  ${error.message}`);
    }

    // Test StoreTag index (if it exists)
    console.log('\nTesting StoreTag index...');
    try {
      const storeTagResults = await Business.aggregate([
        {
          $search: {
            index: 'StoreTag',
            text: {
              query: 'Nike',
              path: 'tags'
            }
          }
        },
        { $limit: 3 }
      ]);
      results.stores.StoreTag = {
        status: '✓ FOUND',
        count: storeTagResults.length
      };
      console.log('✓ StoreTag index: WORKING');
      console.log(`  Found ${storeTagResults.length} results`);
    } catch (error) {
      results.stores.StoreTag = {
        status: '✗ NOT FOUND',
        error: error.message
      };
      console.log('✗ StoreTag index: NOT FOUND');
      console.log(`  ${error.message}`);
    }

    // ========================================
    // 2. VERIFY DEALS INDEXES
    // ========================================
    console.log('\n=== DEALS COLLECTION ===\n');
    
    // Test deal_search index
    console.log('Testing deal_search index...');
    try {
      const dealResults = await Deal.aggregate([
        {
          $search: {
            index: 'deal_search',
            text: {
              query: 'pizza',
              path: ['offerName', 'description', 'cuisine']
            }
          }
        },
        { $limit: 3 },
        { $addFields: { searchScore: { $meta: 'searchScore' } } }
      ]);
      results.deals.deal_search = {
        status: '✓ FOUND',
        count: dealResults.length,
        sample: dealResults.map(r => ({ 
          offerName: r.offerName, 
          score: r.searchScore 
        }))
      };
      console.log('✓ deal_search index: WORKING');
      console.log(`  Found ${dealResults.length} results`);
    } catch (error) {
      results.deals.deal_search = {
        status: '✗ ERROR',
        error: error.message
      };
      console.log('✗ deal_search index: ERROR');
      console.log(`  ${error.message}`);
    }

    // Test Recipes index
    console.log('\nTesting Recipes index...');
    try {
      const recipesResults = await Deal.aggregate([
        {
          $search: {
            index: 'Recipes',
            text: {
              query: 'burger',
              path: 'offerName'
            }
          }
        },
        { $limit: 3 }
      ]);
      results.deals.Recipes = {
        status: '✓ FOUND',
        count: recipesResults.length
      };
      console.log('✓ Recipes index: WORKING');
      console.log(`  Found ${recipesResults.length} results`);
    } catch (error) {
      results.deals.Recipes = {
        status: '✗ NOT FOUND',
        error: error.message
      };
      console.log('✗ Recipes index: NOT FOUND');
      console.log(`  ${error.message}`);
    }

    // Test foodDeals index
    console.log('\nTesting foodDeals index...');
    try {
      const foodDealsResults = await Deal.aggregate([
        {
          $search: {
            index: 'foodDeals',
            text: {
              query: 'burger',
              path: 'offerName'
            }
          }
        },
        { $limit: 3 }
      ]);
      results.deals.foodDeals = {
        status: '✓ FOUND',
        count: foodDealsResults.length
      };
      console.log('✓ foodDeals index: WORKING');
      console.log(`  Found ${foodDealsResults.length} results`);
    } catch (error) {
      results.deals.foodDeals = {
        status: '✗ NOT FOUND',
        error: error.message
      };
      console.log('✗ foodDeals index: NOT FOUND');
      console.log(`  ${error.message}`);
    }

    // ========================================
    // 3. VERIFY LOCATIONS INDEXES
    // ========================================
    console.log('\n=== LOCATIONS COLLECTION ===\n');
    
    // Test location_search index
    console.log('Testing location_search index...');
    try {
      const locationResults = await Location.aggregate([
        {
          $search: {
            index: 'location_search',
            text: {
              query: 'New York',
              path: ['city', 'state', 'address']
            }
          }
        },
        { $limit: 3 },
        { $addFields: { searchScore: { $meta: 'searchScore' } } }
      ]);
      results.locations.location_search = {
        status: '✓ FOUND',
        count: locationResults.length,
        sample: locationResults.map(r => ({ 
          city: r.city, 
          state: r.state,
          score: r.searchScore 
        }))
      };
      console.log('✓ location_search index: WORKING');
      console.log(`  Found ${locationResults.length} results`);
    } catch (error) {
      results.locations.location_search = {
        status: '✗ ERROR',
        error: error.message
      };
      console.log('✗ location_search index: ERROR');
      console.log(`  ${error.message}`);
    }

    // Test geospatial search capability
    console.log('\nTesting geospatial search (geoWithin)...');
    try {
      const geoResults = await Location.aggregate([
        {
          $search: {
            index: 'location_search',
            geoWithin: {
              circle: {
                center: {
                  type: 'Point',
                  coordinates: [-74.0060, 40.7128] // NYC
                },
                radius: 5000 // 5km
              },
              path: 'geoLocation'
            }
          }
        },
        { $limit: 3 }
      ]);
      results.locations.geospatial = {
        status: '✓ WORKING',
        count: geoResults.length
      };
      console.log('✓ Geospatial search: WORKING');
      console.log(`  Found ${geoResults.length} locations within 5km of NYC`);
    } catch (error) {
      results.locations.geospatial = {
        status: '✗ ERROR',
        error: error.message
      };
      console.log('✗ Geospatial search: ERROR');
      console.log(`  ${error.message}`);
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n=== SUMMARY ===\n');
    
    const summary = {
      stores: {
        business_search: results.stores.business_search?.status || '✗ NOT TESTED',
        StoreTag: results.stores.StoreTag?.status || '✗ NOT TESTED'
      },
      deals: {
        deal_search: results.deals.deal_search?.status || '✗ NOT TESTED',
        Recipes: results.deals.Recipes?.status || '✗ NOT TESTED',
        foodDeals: results.deals.foodDeals?.status || '✗ NOT TESTED'
      },
      locations: {
        location_search: results.locations.location_search?.status || '✗ NOT TESTED',
        geospatial: results.locations.geospatial?.status || '✗ NOT TESTED'
      }
    };

    console.log('STORES (businesses collection):');
    console.log(`  business_search: ${summary.stores.business_search}`);
    console.log(`  StoreTag: ${summary.stores.StoreTag}`);
    
    console.log('\nDEALS:');
    console.log(`  deal_search: ${summary.deals.deal_search}`);
    console.log(`  Recipes: ${summary.deals.Recipes}`);
    console.log(`  foodDeals: ${summary.deals.foodDeals}`);
    
    console.log('\nLOCATIONS:');
    console.log(`  location_search: ${summary.locations.location_search}`);
    console.log(`  geospatial: ${summary.locations.geospatial}`);

    console.log('\n=== RECOMMENDATIONS ===\n');
    
    if (results.stores.StoreTag?.status === '✗ NOT FOUND') {
      console.log('⚠ StoreTag index not found on stores collection');
      console.log('  → This index may not be needed if business_search is working');
    }
    
    if (results.deals.Recipes?.status === '✗ NOT FOUND') {
      console.log('⚠ Recipes index not found on deals collection');
      console.log('  → Create this index in Atlas if you need it');
    }
    
    if (results.deals.foodDeals?.status === '✗ NOT FOUND') {
      console.log('⚠ foodDeals index not found on deals collection');
      console.log('  → Create this index in Atlas if you need it');
    }

    if (results.locations.geospatial?.status === '✗ ERROR') {
      console.log('⚠ Geospatial search not working');
      console.log('  → Check that geoLocation field is properly indexed in location_search');
    }

  } catch (error) {
    console.error('Verification failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
}

verifyAtlasIndexes();
