const mongoose = require('mongoose');
require('dotenv').config();

const SearchIndex = require('../models/SearchIndex');

async function checkSearchIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas\n');

    // Count documents
    const count = await SearchIndex.countDocuments();
    console.log(`Total documents in search_index: ${count}\n`);

    // Get sample documents
    const samples = await SearchIndex.find().limit(5).lean();
    
    console.log('=== SAMPLE DOCUMENTS ===\n');
    samples.forEach((doc, idx) => {
      console.log(`${idx + 1}. ${doc.businessName}`);
      console.log(`   Location: ${doc.location.city}, ${doc.location.state}`);
      console.log(`   Coordinates: [${doc.location.coordinates[0]}, ${doc.location.coordinates[1]}]`);
      console.log(`   Dishes: ${doc.dishes.length}`);
      console.log(`   Cuisines: ${doc.cuisine.join(', ')}`);
      console.log('');
    });

    // Check coordinate validity
    console.log('=== COORDINATE VALIDATION ===\n');
    const invalidCoords = await SearchIndex.find({
      $or: [
        { 'location.coordinates.0': { $lt: -180 } },
        { 'location.coordinates.0': { $gt: 180 } },
        { 'location.coordinates.1': { $lt: -90 } },
        { 'location.coordinates.1': { $gt: 90 } }
      ]
    }).countDocuments();
    
    console.log(`Documents with invalid coordinates: ${invalidCoords}`);
    
    if (invalidCoords === 0) {
      console.log('✓ All coordinates are valid!\n');
    }

    // Group by cuisine
    const cuisineStats = await SearchIndex.aggregate([
      { $unwind: '$cuisine' },
      { $group: { _id: '$cuisine', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    console.log('=== TOP CUISINES ===\n');
    cuisineStats.forEach((stat, idx) => {
      console.log(`${idx + 1}. ${stat._id}: ${stat.count} locations`);
    });

    // Check for dishes
    const dishStats = await SearchIndex.aggregate([
      { $project: { dishCount: { $size: '$dishes' } } },
      { $group: { 
          _id: null, 
          totalDishes: { $sum: '$dishCount' },
          avgDishes: { $avg: '$dishCount' },
          maxDishes: { $max: '$dishCount' },
          minDishes: { $min: '$dishCount' }
        }
      }
    ]);

    console.log('\n=== DISH STATISTICS ===\n');
    if (dishStats.length > 0) {
      console.log(`Total dishes: ${dishStats[0].totalDishes}`);
      console.log(`Average dishes per location: ${dishStats[0].avgDishes.toFixed(1)}`);
      console.log(`Max dishes: ${dishStats[0].maxDishes}`);
      console.log(`Min dishes: ${dishStats[0].minDishes}`);
    }

    console.log('\n✓ Data looks good! Ready to test autocomplete.');
    console.log('\nNext step: Create Atlas Search index "autocomplete_geo_index"');
    console.log('Then run: node scripts/testAutocomplete.js');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkSearchIndex();
