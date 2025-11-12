require('dotenv').config();
const mongoose = require('mongoose');
const SearchIndex = require('../models/SearchIndex');

async function testAutocompleteSearchFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Test parameters
    const query = 'Byte Food';
    const lat = 47.6062;  // Seattle
    const lng = -122.3321;
    const maxDistance = 5; // miles
    const maxDistanceMeters = maxDistance * 1609.34;

    console.log('=== Testing Autocomplete Search Fix ===');
    console.log(`Query: "${query}"`);
    console.log(`Location: [${lng}, ${lat}]`);
    console.log(`Max Distance: ${maxDistance} miles (${maxDistanceMeters}m)\n`);

    // First, check if "Byte Food" exists in the collection
    console.log('=== Step 1: Check if "Byte Food" exists ===');
    const byteFood = await SearchIndex.findOne({ 
      businessName: { $regex: 'Byte', $options: 'i' } 
    });
    
    if (byteFood) {
      console.log(`Found: ${byteFood.businessName}`);
      console.log(`Location: ${byteFood.location?.coordinates}`);
      console.log(`City: ${byteFood.location?.city}`);
      console.log(`Dishes: ${byteFood.dishes?.length || 0}`);
    } else {
      console.log('No business matching "Byte" found in collection');
    }

    // Test the OLD query (with must + should, no minimumShouldMatch)
    console.log('\n=== Step 2: OLD Query (BROKEN) ===');
    const oldResults = await SearchIndex.aggregate([
      {
        $search: {
          index: 'autocomplete_geo_index',
          compound: {
            must: [
              {
                geoWithin: {
                  circle: {
                    center: { type: 'Point', coordinates: [lng, lat] },
                    radius: maxDistanceMeters
                  },
                  path: 'location.coordinates'
                }
              }
            ],
            should: [
              {
                autocomplete: {
                  query: query,
                  path: 'businessName',
                  fuzzy: { maxEdits: 1, prefixLength: 2 }
                }
              }
            ]
          }
        }
      },
      { $limit: 5 },
      { $addFields: { searchScore: { $meta: 'searchScore' } } },
      { $project: { businessName: 1, searchScore: 1 } }
    ]);
    console.log(`Results: ${oldResults.length}`);
    oldResults.forEach(r => console.log(`  - ${r.businessName} (score: ${r.searchScore})`));

    // Test the NEW query (with filter + should + minimumShouldMatch)
    console.log('\n=== Step 3: NEW Query (FIXED) ===');
    const newResults = await SearchIndex.aggregate([
      {
        $search: {
          index: 'autocomplete_geo_index',
          compound: {
            filter: [
              {
                geoWithin: {
                  circle: {
                    center: { type: 'Point', coordinates: [lng, lat] },
                    radius: maxDistanceMeters
                  },
                  path: 'location.coordinates'
                }
              }
            ],
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
                  path: 'dishes.name',
                  fuzzy: { maxEdits: 1, prefixLength: 2 },
                  score: { boost: { value: 2 } }
                }
              }
            ],
            minimumShouldMatch: 1
          }
        }
      },
      { $limit: 5 },
      { $addFields: { searchScore: { $meta: 'searchScore' } } },
      { $project: { businessName: 1, 'dishes.name': 1, searchScore: 1 } }
    ]);
    console.log(`Results: ${newResults.length}`);
    newResults.forEach(r => {
      console.log(`  - ${r.businessName} (score: ${r.searchScore})`);
      if (r.dishes && r.dishes.length > 0) {
        console.log(`    Dishes: ${r.dishes.map(d => d.name).join(', ')}`);
      }
    });

    console.log('\n=== Summary ===');
    console.log('The key differences:');
    console.log('1. OLD: Uses "must" for geo (required) + "should" for text (optional)');
    console.log('   Result: Returns ALL docs in radius, regardless of text match');
    console.log('2. NEW: Uses "filter" for geo + "should" for text + minimumShouldMatch: 1');
    console.log('   Result: Returns only docs that match BOTH location AND text query');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

testAutocompleteSearchFix();
