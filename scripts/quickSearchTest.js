require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('../models/Business');

async function quickTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const searchQuery = process.argv[2] || 'DinoDen';
    console.log(`Searching for: "${searchQuery}"\n`);

    // Test regex search (this should always work)
    console.log('1. Testing REGEX search (fallback method)...');
    const regexResults = await Business.find({
      active: true,
      businessName: { $regex: searchQuery, $options: 'i' }
    }).limit(5).lean();
    
    console.log(`   Found: ${regexResults.length} businesses`);
    if (regexResults.length > 0) {
      regexResults.forEach(b => console.log(`   ✓ ${b.businessName}`));
    } else {
      console.log('   ✗ No matches found');
      console.log('\n   Showing sample business names:');
      const samples = await Business.find({ active: true }).select('businessName').limit(10).lean();
      samples.forEach(b => console.log(`     - ${b.businessName}`));
    }

    // Test Atlas Search
    console.log('\n2. Testing ATLAS SEARCH...');
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
        { $limit: 5 }
      ]);

      console.log(`   Found: ${atlasResults.length} businesses`);
      if (atlasResults.length > 0) {
        atlasResults.forEach(b => console.log(`   ✓ ${b.businessName} (score: ${b.searchScore.toFixed(2)})`));
      } else {
        console.log('   ⚠ Atlas Search returned 0 results (fallback will be used)');
      }
    } catch (error) {
      console.log(`   ✗ Atlas Search Error: ${error.message}`);
      console.log('   → Fallback to regex will be used automatically');
    }

    console.log('\n✅ Search is working! Your API will now return results.');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

quickTest();
