require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');

async function testSearch() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const searchQuery = process.argv[2] || 'Nike';
    console.log(`\nTesting search for: "${searchQuery}"\n`);

    // Test 1: Count total businesses
    const totalCount = await Business.countDocuments();
    console.log(`Total businesses in DB: ${totalCount}`);

    // Test 2: Count active businesses
    const activeCount = await Business.countDocuments({ active: true });
    console.log(`Active businesses: ${activeCount}`);

    // Test 3: Regex search (fallback method)
    const regexResults = await Business.find({
      active: true,
      businessName: { $regex: searchQuery, $options: 'i' }
    }).limit(5).lean();
    console.log(`\nRegex search found: ${regexResults.length} businesses`);
    regexResults.forEach(b => console.log(`  - ${b.businessName}`));

    // Test 4: Atlas Search
    console.log('\nTrying Atlas Search...');
    try {
      const atlasResults = await Business.aggregate([
        {
          $search: {
            index: 'business_search',
            compound: {
              must: [
                {
                  text: {
                    query: searchQuery,
                    path: ['businessName', 'tags'],
                    fuzzy: { maxEdits: 2 }
                  }
                }
              ],
              filter: [
                {
                  equals: {
                    path: 'active',
                    value: true
                  }
                }
              ]
            }
          }
        },
        {
          $addFields: {
            searchScore: { $meta: 'searchScore' }
          }
        },
        {
          $sort: {
            searchScore: -1,
            dealsCount: -1
          }
        },
        {
          $limit: 5
        }
      ]);

      console.log(`Atlas Search found: ${atlasResults.length} businesses`);
      atlasResults.forEach(b => console.log(`  - ${b.businessName} (score: ${b.searchScore})`));
    } catch (error) {
      console.error('Atlas Search Error:', error.message);
      console.log('\nThis likely means:');
      console.log('1. Atlas Search index "business_search" is not created');
      console.log('2. Or the index is not synced yet');
      console.log('3. Or you need to check your MongoDB Atlas configuration');
    }

    // Test 5: Sample business names
    console.log('\nSample business names in DB:');
    const samples = await Business.find({ active: true })
      .select('businessName')
      .limit(10)
      .lean();
    samples.forEach(b => console.log(`  - ${b.businessName}`));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testSearch();
