require('dotenv').config();
const mongoose = require('mongoose');
const SearchIndex = require('../models/SearchIndex');

async function diagnoseAutocomplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Check if data exists
    const totalDocs = await SearchIndex.countDocuments();
    console.log(`Total documents in search_index: ${totalDocs}\n`);

    if (totalDocs === 0) {
      console.log('No documents found in search_index collection!');
      await mongoose.connection.close();
      return;
    }

    // Get sample document
    const sampleDoc = await SearchIndex.findOne();
    console.log('=== Sample Document ===');
    console.log(JSON.stringify(sampleDoc, null, 2));
    console.log('\n');

    // Seattle coordinates (near Grumpys Food Truck)
    const lat = 47.6678282;
    const lng = -122.3791839;
    const query = 'gar';

    console.log('=== Test 1: Simple text search (no geo) ===');
    try {
      const textResults = await SearchIndex.aggregate([
        {
          $search: {
            index: 'autocomplete_geo_index',
            autocomplete: {
              query: query,
              path: 'businessName'
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.city': 1 } }
      ]);
      console.log(`Found ${textResults.length} results`);
      textResults.forEach(r => console.log(`- ${r.businessName} (${r.location?.city})`));
    } catch (error) {
      console.log('Error:', error.message);
    }

    console.log('\n=== Test 2: Geo search only (no text) ===');
    try {
      const geoResults = await SearchIndex.aggregate([
        {
          $search: {
            index: 'autocomplete_geo_index',
            geoWithin: {
              circle: {
                center: {
                  type: 'Point',
                  coordinates: [lng, lat]
                },
                radius: 50000
              },
              path: 'location.coordinates'
            }
          }
        },
        { $limit: 5 },
        { $project: { businessName: 1, 'location.coordinates': 1 } }
      ]);
      console.log(`Found ${geoResults.length} results`);
      geoResults.forEach(r => console.log(`- ${r.businessName} at [${r.location?.coordinates}]`));
    } catch (error) {
      console.log('Error:', error.message);
    }

    console.log('\n=== Test 3: Compound with must (geo) + should (text) ===');
    try {
      const compoundResults = await SearchIndex.aggregate([
        {
          $search: {
            index: 'autocomplete_geo_index',
            compound: {
              must: [
                {
                  geoWithin: {
                    circle: {
                      center: {
                        type: 'Point',
                        coordinates: [lng, lat]
                      },
                      radius: 50000
                    },
                    path: 'location.coordinates'
                  }
                }
              ],
              should: [
                {
                  autocomplete: {
                    query: query,
                    path: 'businessName'
                  }
                }
              ],
              minimumShouldMatch: 1
            }
          }
        },
        { $limit: 5 },
        { $addFields: { searchScore: { $meta: 'searchScore' } } },
        { $project: { businessName: 1, 'location.city': 1, searchScore: 1 } }
      ]);
      console.log(`Found ${compoundResults.length} results`);
      compoundResults.forEach(r => console.log(`- ${r.businessName} (${r.location?.city}) - score: ${r.searchScore}`));
    } catch (error) {
      console.log('Error:', error.message);
    }

    console.log('\n=== Test 4: Compound with filter (geo) + should (text) ===');
    try {
      const filterResults = await SearchIndex.aggregate([
        {
          $search: {
            index: 'autocomplete_geo_index',
            compound: {
              filter: [
                {
                  geoWithin: {
                    circle: {
                      center: {
                        type: 'Point',
                        coordinates: [lng, lat]
                      },
                      radius: 50000
                    },
                    path: 'location.coordinates'
                  }
                }
              ],
              should: [
                {
                  autocomplete: {
                    query: query,
                    path: 'businessName'
                  }
                },
                {
                  autocomplete: {
                    query: query,
                    path: 'dishes.name'
                  }
                }
              ]
            }
          }
        },
        { $limit: 5 },
        { $addFields: { searchScore: { $meta: 'searchScore' } } },
        { $project: { businessName: 1, 'location.city': 1, searchScore: 1 } }
      ]);
      console.log(`Found ${filterResults.length} results`);
      filterResults.forEach(r => console.log(`- ${r.businessName} (${r.location?.city}) - score: ${r.searchScore}`));
    } catch (error) {
      console.log('Error:', error.message);
    }

  } catch (error) {
    console.error('Diagnosis failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

diagnoseAutocomplete();
