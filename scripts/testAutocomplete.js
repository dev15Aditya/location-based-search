const mongoose = require('mongoose');
require('dotenv').config();

const SearchIndex = require('../models/SearchIndex');

// Seattle downtown coordinates
const SEATTLE_LAT = 47.6062;
const SEATTLE_LNG = -122.3321;

async function autocompleteSearch(query, userLat, userLng, radiusInMeters = 5000) {
  const pipeline = [
    // {
    //   $search: {
    //     index: "autocomplete_geo_index",
    //     compound: {
    //       should: [
    //         {
    //           autocomplete: {
    //             query: query,
    //             path: "businessName",
    //             fuzzy: {
    //               maxEdits: 1,
    //               prefixLength: 2
    //             },
    //             score: { boost: { value: 3 } }
    //           }
    //         },
    //         // {
    //         //   autocomplete: {
    //         //     query: query,
    //         //     path: "dishes.name",
    //         //     fuzzy: {
    //         //       maxEdits: 1,
    //         //       prefixLength: 2
    //         //     },
    //         //     score: { boost: { value: 2 } }
    //         //   }
    //         // },
    //         // {
    //         //   text: {
    //         //     query: query,
    //         //     path: "cuisine",
    //         //     fuzzy: {
    //         //       maxEdits: 1
    //         //     },
    //         //     score: { boost: { value: 2 } }
    //         //   }
    //         // },
    //         {
    //           near: {
    //             path: "location.coordinates",
    //             origin: {
    //               type: "Point",
    //               coordinates: [userLng, userLat]
    //             },
    //             pivot: 1000,
    //             score: { boost: { value: 3 } }
    //           }
    //         }
    //       ],
    //       filter: [
    //         {
    //           geoWithin: {
    //             circle: {
    //               center: {
    //                 type: "Point",
    //                 coordinates: [userLng, userLat]
    //               },
    //               radius: radiusInMeters
    //             },
    //             path: "location.coordinates"
    //           }
    //         }
    //       ],
    //       minimumShouldMatch: 1
    //     }
    //   }
    // },
    {
      $search: {
        index: "autocomplete_geo_index",
        compound: {
          must: [
            {
              autocomplete: {
                query,
                path: "businessName",
                fuzzy: { maxEdits: 1, prefixLength: 2 },
                score: { boost: { value: 3 } }
              }
            },
            // {
            //   autocomplete: {
            //     query: query,
            //     path: "dishes.name",
            //     fuzzy: {
            //       maxEdits: 1,
            //       prefixLength: 2
            //     },
            //     score: { boost: { value: 2 } }
            //   }
            // },
            // {
            //   text: {
            //     query: query,
            //     path: "cuisine",
            //     fuzzy: {
            //       maxEdits: 1
            //     },
            //     score: { boost: { value: 2 } }
            //   }
            // },
          ],
          should: [
            {
              near: {
                path: "location.coordinates",
                origin: { type: "Point", coordinates: [userLng, userLat] },
                pivot: 1000,
                score: { boost: { value: 2 } }
              }
            }
          ],
          filter: [
            {
              geoWithin: {
                circle: {
                  center: { type: "Point", coordinates: [userLng, userLat] },
                  radius: radiusInMeters
                },
                path: "location.coordinates"
              }
            }
          ]
        }
      }
    },
    {
      $addFields: {
        distance: {
          $round: [
            {
              $multiply: [
                {
                  $sqrt: {
                    $add: [
                      {
                        $pow: [
                          {
                            $subtract: [
                              { $arrayElemAt: ["$location.coordinates", 1] },
                              userLat
                            ]
                          },
                          2
                        ]
                      },
                      {
                        $pow: [
                          {
                            $multiply: [
                              {
                                $subtract: [
                                  { $arrayElemAt: ["$location.coordinates", 0] },
                                  userLng
                                ]
                              },
                              { $cos: { $degreesToRadians: userLat } }
                            ]
                          },
                          2
                        ]
                      }
                    ]
                  }
                },
                111320
              ]
            },
            0
          ]
        },
        searchScore: { $meta: "searchScore" }
      }
    },
    {
      $sort: { searchScore: -1, distance: 1 }
    },
    {
      $limit: 50
    },
    {
      $project: {
        businessId: 1,
        businessName: 1,
        businessLogoUrl: 1,
        location: 1,
        dishes: 1,
        cuisine: 1,
        distance: 1,
        searchScore: 1
      }
    }
  ];

  return await SearchIndex.aggregate(pipeline);
}

function groupSearchResults(results) {
  const grouped = {
    dishes: [],
    cuisines: new Map(),
    businesses: []
  };

  const seenDishes = new Set();
  const seenBusinesses = new Set();

  results.forEach(result => {
    // Group dishes
    result.dishes.forEach(dish => {
      const dishKey = `${dish.name}_${result.businessId}`;
      if (!seenDishes.has(dishKey) && grouped.dishes.length < 5) {
        grouped.dishes.push({
          name: dish.name,
          businessName: result.businessName,
          businessId: result.businessId,
          cuisine: dish.cuisine,
          price: dish.offerPrice || dish.actualPrice,
          distance: result.distance,
          location: result.location
        });
        seenDishes.add(dishKey);
      }
    });

    // Group cuisines
    result.cuisine.forEach(cuisine => {
      if (cuisine) {
        if (!grouped.cuisines.has(cuisine)) {
          grouped.cuisines.set(cuisine, {
            name: cuisine,
            count: 0,
            minDistance: result.distance
          });
        }
        const cuisineData = grouped.cuisines.get(cuisine);
        cuisineData.count++;
        cuisineData.minDistance = Math.min(cuisineData.minDistance, result.distance);
      }
    });

    // Group businesses
    if (!seenBusinesses.has(result.businessId.toString()) && grouped.businesses.length < 5) {
      grouped.businesses.push({
        businessId: result.businessId,
        businessName: result.businessName,
        businessLogoUrl: result.businessLogoUrl,
        distance: result.distance,
        location: result.location,
        cuisines: result.cuisine,
        dishCount: result.dishes.length
      });
      seenBusinesses.add(result.businessId.toString());
    }
  });

  return {
    dishes: grouped.dishes,
    cuisines: Array.from(grouped.cuisines.values())
      .sort((a, b) => a.minDistance - b.minDistance)
      .slice(0, 5),
    businesses: grouped.businesses
  };
}

async function testAutocomplete() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas\n');

    // Test queries
    const testQueries = [
      { query: 'Byte Food', radius: 5000 },
      // { query: 'burger', radius: 5000 },
      // { query: 'sushi', radius: 10000 },
      // { query: 'italian', radius: 5000 }
    ];

    console.log('=== TESTING AUTOCOMPLETE SEARCH ===\n');
    console.log(`User Location: Seattle Downtown (${SEATTLE_LAT}, ${SEATTLE_LNG})\n`);

    for (const test of testQueries) {

      try {
        const results = await autocompleteSearch(
          test.query,
          SEATTLE_LAT,
          SEATTLE_LNG,
          test.radius
        );

        console.log("result__>> ", results);
        
        if (results.length > 0) {
          // Show first 3 raw results
          console.log('--- Top 3 Raw Results ---');
          results.slice(0, 3).forEach((result, idx) => {
            console.log(`\n${idx + 1}. ${result.businessName}`);
            console.log(`   Distance: ${result.distance}m`);
            console.log(`   Score: ${result.searchScore.toFixed(2)}`);
            console.log(`   Location: ${result.location.city}, ${result.location.state}`);
            console.log(`   Dishes: ${result.dishes.length}`);
            console.log(`   Cuisines: ${result.cuisine.join(', ')}`);
          });

          // Group results
          const grouped = groupSearchResults(results);

          console.log('\n--- Grouped Results ---\n');

          console.log('DISHES:');
          grouped.dishes.forEach((dish, idx) => {
            console.log(`  ${idx + 1}. ${dish.name} - ${dish.businessName}`);
            console.log(`     ${dish.distance}m away | $${dish.price} | ${dish.cuisine}`);
          });

          console.log('\nCUISINES:');
          grouped.cuisines.forEach((cuisine, idx) => {
            console.log(`  ${idx + 1}. ${cuisine.name} (${cuisine.count} restaurants, nearest: ${cuisine.minDistance}m)`);
          });

          console.log('\nBUSINESSES:');
          grouped.businesses.forEach((business, idx) => {
            console.log(`  ${idx + 1}. ${business.businessName}`);
            console.log(`     ${business.distance}m away | ${business.dishCount} dishes | ${business.cuisines.join(', ')}`);
          });
        } else {
          console.log('No results found.');
        }

      } catch (error) {
        console.error('Error:', error.message);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\nDatabase connection closed');
  }
}

testAutocomplete();
