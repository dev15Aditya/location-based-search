require('dotenv').config();
const mongoose = require('mongoose');
const Deal = require('../models/Deal');

async function testAutocomplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const testQueries = ['bur', 'piz', 'chi', 'sal'];

    for (const query of testQueries) {
      console.log(`\n=== Testing autocomplete for: "${query}" ===\n`);

      // Test autocomplete search
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
        { $limit: 20 },
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

      console.log(`Found ${results.length} deals`);

      // Extract unique tags
      const tagScores = new Map();
      const queryLower = query.toLowerCase();

      results.forEach(deal => {
        if (deal.tags && Array.isArray(deal.tags)) {
          deal.tags.forEach(tag => {
            const tagLower = tag.toLowerCase();
            if (tagLower.includes(queryLower)) {
              let score = deal.searchScore;
              
              if (tagLower === queryLower) {
                score += 100;
              } else if (tagLower.startsWith(queryLower)) {
                score += 50;
              }
              
              if (!tagScores.has(tag) || tagScores.get(tag) < score) {
                tagScores.set(tag, score);
              }
            }
          });
        }
      });

      // Sort and display top tags
      const topTags = Array.from(tagScores.entries())
        .map(([tag, score]) => ({ tag, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      console.log('\nTop matching tags:');
      topTags.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.tag} (score: ${item.score.toFixed(2)})`);
      });

      if (topTags.length === 0) {
        console.log('  No matching tags found');
      }
    }

    console.log('\n✓ Autocomplete test completed');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testAutocomplete();
