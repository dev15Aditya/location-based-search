const mongoose = require('mongoose');
require('dotenv').config();

const SearchIndex = require('../models/SearchIndex');

const SEATTLE_LAT = 47.6062;
const SEATTLE_LNG = -122.3321;

async function debugAtlasSearch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas\n');

    // Test 1: Simple autocomplete without geo filter
    console.log('=== TEST 1: Simple Autocomplete (No Geo Filter) ===\n');
    try {
      const test1 = await SearchIndex.aggregate([
        {
          $search: {
            index: "autocomplete_geo_index",
            autocomplete: {
              query: "Byte",
              path: "businessName"
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.city': 1, 'location.coordinates': 1 } }
      ]);
      console.log(`Results: ${test1.length}`);
      test1.forEach(r => console.log(`  - ${r.businessName} at [${r.location.coordinates}]`));
    } catch (error) {
      console.log('ERROR:', error.message);
    }

    // Test 2: Text search without geo
    console.log('\n=== TEST 2: Text Search (No Geo Filter) ===\n');
    try {
      const test2 = await SearchIndex.aggregate([
        {
          $search: {
            index: "autocomplete_geo_index",
            text: {
              query: "Byte",
              path: "businessName"
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.city': 1 } }
      ]);
      console.log(`Results: ${test2.length}`);
      test2.forEach(r => console.log(`  - ${r.businessName}`));
    } catch (error) {
      console.log('ERROR:', error.message);
    }

    // Test 3: Autocomplete with large geo radius
    console.log('\n=== TEST 3: Autocomplete + Geo (50km radius) ===\n');
    try {
      const test3 = await SearchIndex.aggregate([
        {
          $search: {
            index: "autocomplete_geo_index",
            compound: {
              must: [
                {
                  autocomplete: {
                    query: "Byte",
                    path: "businessName"
                  }
                }
              ],
              filter: [
                {
                  geoWithin: {
                    circle: {
                      center: {
                        type: "Point",
                        coordinates: [SEATTLE_LNG, SEATTLE_LAT]
                      },
                      radius: 50000
                    },
                    path: "location.coordinates"
                  }
                }
              ]
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.coordinates': 1 } }
      ]);
      console.log(`Results: ${test3.length}`);
      test3.forEach(r => console.log(`  - ${r.businessName} at [${r.location.coordinates}]`));
    } catch (error) {
      console.log('ERROR:', error.message);
    }

    // Test 4: Just geo search with near
    console.log('\n=== TEST 4: Geo Near Search ===\n');
    try {
      const test4 = await SearchIndex.aggregate([
        {
          $search: {
            index: "autocomplete_geo_index",
            near: {
              path: "location.coordinates",
              origin: {
                type: "Point",
                coordinates: [SEATTLE_LNG, SEATTLE_LAT]
              },
              pivot: 5000
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.coordinates': 1 } }
      ]);
      console.log(`Results: ${test4.length}`);
      test4.forEach(r => console.log(`  - ${r.businessName} at [${r.location.coordinates}]`));
    } catch (error) {
      console.log('ERROR:', error.message);
    }

    // Test 5: Check actual distances
    console.log('\n=== TEST 5: Calculate Actual Distances ===\n');
    const allDocs = await SearchIndex.find().limit(5).lean();
    allDocs.forEach(doc => {
      const [lng, lat] = doc.location.coordinates;
      const distance = calculateDistance(SEATTLE_LAT, SEATTLE_LNG, lat, lng);
      console.log(`${doc.businessName}: ${distance.toFixed(0)}m away`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

debugAtlasSearch();
