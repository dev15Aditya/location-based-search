require('dotenv').config();
const mongoose = require('mongoose');
const SearchIndex = require('../models/SearchIndex');

async function checkIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Get collection
    const collection = SearchIndex.collection;

    // List all indexes
    console.log('=== MongoDB Indexes ===');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(idx => {
      console.log(`- ${idx.name}:`, JSON.stringify(idx.key, null, 2));
    });

    console.log('\n=== Testing with MongoDB $geoNear (fallback) ===');
    const lat = 47.6678282;
    const lng = -122.3791839;
    
    const geoResults = await SearchIndex.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          distanceField: 'distance',
          maxDistance: 50000,
          spherical: true
        }
      },
      {
        $match: {
          $or: [
            { businessName: { $regex: 'gar', $options: 'i' } },
            { 'dishes.name': { $regex: 'gar', $options: 'i' } },
            { cuisine: { $regex: 'gar', $options: 'i' } }
          ]
        }
      },
      { $limit: 5 },
      { $project: { businessName: 1, 'location.city': 1, distance: 1 } }
    ]);

    console.log(`Found ${geoResults.length} results using $geoNear:`);
    geoResults.forEach(r => {
      console.log(`- ${r.businessName} (${r.location?.city}) - ${(r.distance / 1000).toFixed(2)}km away`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

checkIndexes();
