require('dotenv').config();
const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Business = require('../models/Business');

async function testUnifiedAutocomplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');

    const testQueries = ['bur', 'chi', 'piz'];

    for (const query of testQueries) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing unified autocomplete for: "${query}"`);
      console.log('='.repeat(60));

      const queryLower = query.toLowerCase();
      const suggestions = {
        dishes: new Map(),
        stores: new Map(),
        cuisines: new Map()
      };

      // Test 1: Search deals using foodDeals index
      // Only searches: tags, offerName
      console.log('\n[1/2] Searching deals (foodDeals index)...');
      try {
        const dealResults = await Deal.aggregate([
          {
            $search: {
              index: 'foodDeals',
              compound: {
                should: [
                  {
                    autocomplete: {
                      query: query,
                      path: 'tags',
                      fuzzy: { maxEdits: 1, prefixLength: 2 },
                      score: { boost: { value: 3 } }
                    }
                  },
                  {
                    autocomplete: {
                      query: query,
                      path: 'offerName',
                      fuzzy: { maxEdits: 1, prefixLength: 2 },
                      score: { boost: { value: 2 } }
                    }
                  }
                ]
              }
            }
          },
          { $limit: 100 },
          { $addFields: { searchScore: { $meta: 'searchScore' } } },
          { $project: { tags: 1, offerName: 1, searchScore: 1 } }
        ]);

        console.log(`  ✓ Found ${dealResults.length} deals`);

        // Process deals - extract dishes
        dealResults.forEach(deal => {
          if (deal.tags && Array.isArray(deal.tags)) {
            deal.tags.forEach(tag => {
              const tagLower = tag.toLowerCase();
              if (tagLower.includes(queryLower)) {
                let score = deal.searchScore * 3;
                if (tagLower === queryLower) score += 100;
                else if (tagLower.startsWith(queryLower)) score += 50;
                
                if (!suggestions.dishes.has(tag) || suggestions.dishes.get(tag) < score) {
                  suggestions.dishes.set(tag, score);
                }
              }
            });
          }

          if (deal.offerName) {
            const offerLower = deal.offerName.toLowerCase();
            if (offerLower.includes(queryLower)) {
              let score = deal.searchScore * 2;
              if (offerLower === queryLower) score += 100;
              else if (offerLower.startsWith(queryLower)) score += 50;
              
              if (!suggestions.dishes.has(deal.offerName) || suggestions.dishes.get(deal.offerName) < score) {
                suggestions.dishes.set(deal.offerName, score);
              }
            }
          }
        });
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
      }

      // Test 2: Search businesses using StoreTag index
      // Searches: businessName, tags, filters.cuisine, filters.course
      console.log('[2/2] Searching businesses (StoreTag index)...');
      try {
        const businessResults = await Business.aggregate([
          {
            $search: {
              index: 'business_search',
              compound: {
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
                      path: 'tags',
                      fuzzy: { maxEdits: 1, prefixLength: 2 }
                    }
                  },
                  // {
                  //   autocomplete: {
                  //     query: query,
                  //     path: 'filters.cuisine',
                  //     fuzzy: { maxEdits: 1, prefixLength: 2 },
                  //     score: { boost: { value: 2 } }
                  //   }
                  // },
                  // {
                  //   autocomplete: {
                  //     query: query,
                  //     path: 'filters.course',
                  //     fuzzy: { maxEdits: 1, prefixLength: 2 }
                  //   }
                  // }
                ]
              }
            }
          },
          { $limit: 50 },
          { $addFields: { searchScore: { $meta: 'searchScore' } } },
          { $project: { businessName: 1, tags: 1, filters: 1, searchScore: 1 } }
        ]);

        console.log(`  ✓ Found ${businessResults.length} businesses`);

        businessResults.forEach(business => {
          // Extract store names
          if (business.businessName) {
            const nameLower = business.businessName.toLowerCase();
            if (nameLower.includes(queryLower)) {
              let score = business.searchScore * 3;
              if (nameLower === queryLower) score += 100;
              else if (nameLower.startsWith(queryLower)) score += 50;
              
              if (!suggestions.stores.has(business.businessName) || suggestions.stores.get(business.businessName) < score) {
                suggestions.stores.set(business.businessName, score);
              }
            }
          }

          // Extract cuisines from filters.cuisine
          if (business.filters && business.filters.cuisine) {
            const cuisines = Array.isArray(business.filters.cuisine) 
              ? business.filters.cuisine 
              : [business.filters.cuisine];
            
            cuisines.forEach(cuisine => {
              if (cuisine) {
                const cuisineLower = cuisine.toLowerCase();
                if (cuisineLower.includes(queryLower)) {
                  let score = business.searchScore * 2;
                  if (cuisineLower === queryLower) score += 100;
                  else if (cuisineLower.startsWith(queryLower)) score += 50;
                  
                  if (!suggestions.cuisines.has(cuisine) || suggestions.cuisines.get(cuisine) < score) {
                    suggestions.cuisines.set(cuisine, score);
                  }
                }
              }
            });
          }
        });
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
      }

      // Display results
      console.log('\n--- RESULTS ---\n');

      console.log('DISHES (tags + offer names):');
      const topDishes = Array.from(suggestions.dishes.entries())
        .map(([text, score]) => ({ text, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      if (topDishes.length > 0) {
        topDishes.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.text} (${item.score.toFixed(2)})`);
        });
      } else {
        console.log('  No dishes found');
      }

      console.log('\nSTORES (business names):');
      const topStores = Array.from(suggestions.stores.entries())
        .map(([text, score]) => ({ text, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      if (topStores.length > 0) {
        topStores.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.text} (${item.score.toFixed(2)})`);
        });
      } else {
        console.log('  No stores found');
      }

      console.log('\nCUISINES (from filters.cuisine):');
      const topCuisines = Array.from(suggestions.cuisines.entries())
        .map(([text, score]) => ({ text, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      
      if (topCuisines.length > 0) {
        topCuisines.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.text} (${item.score.toFixed(2)})`);
        });
      } else {
        console.log('  No cuisines found');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Unified autocomplete test completed');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

testUnifiedAutocomplete();
