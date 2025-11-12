require('dotenv').config();
const mongoose = require('mongoose');
const SearchIndex = require('../models/SearchIndex');

async function testAutocompleteGeo() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Seattle coordinates
    const lat = 47.6062;
    const lng = -122.3321;
    const query = 'gar'; // Testing with "gar" to match "Garbage Salad", "Grumpys"
    const maxDistance = 50000; // 50km

    console.log('\n=== Testing Autocomplete Geo Search ===');
    console.log(`Query: "${query}"`);
    console.log(`Location: ${lat}, ${lng}`);
    console.log(`Max Distance: ${maxDistance}m\n`);

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          distanceField: 'distance',
          maxDistance: maxDistance,
          spherical: true
        }
      },
      {
        $match: {
          $or: [
            { businessName: { $regex: query, $options: 'i' } },
            { 'dishes.name': { $regex: query, $options: 'i' } },
            { cuisine: { $regex: query, $options: 'i' } }
          ]
        }
      },
      {
        $limit: 100
      },
      {
        $project: {
          businessName: 1,
          businessLogoUrl: 1,
          slug: 1,
          location: 1,
          dishes: 1,
          cuisine: 1,
          distance: 1
        }
      }
    ];

    const results = await SearchIndex.aggregate(pipeline);

    console.log(`Found ${results.length} results\n`);

    // Group results
    const queryLower = query.toLowerCase();
    const grouped = {
      businesses: new Map(),
      dishes: new Map(),
      cuisines: new Map()
    };

    results.forEach(doc => {
      // Calculate base score (closer = higher score)
      const distanceScore = Math.max(0, 100 - (doc.distance / maxDistance) * 100);

      // Extract matching businesses
      if (doc.businessName) {
        const nameLower = doc.businessName.toLowerCase();
        if (nameLower.includes(queryLower)) {
          let score = distanceScore * 3;
          if (nameLower === queryLower) score += 1000;
          else if (nameLower.startsWith(queryLower)) score += 500;
          else score += 100;

          if (!grouped.businesses.has(doc.businessName) || grouped.businesses.get(doc.businessName).score < score) {
            grouped.businesses.set(doc.businessName, { name: doc.businessName, distance: doc.distance, score });
          }
        }
      }

      // Extract matching dishes
      if (doc.dishes && Array.isArray(doc.dishes)) {
        doc.dishes.forEach(dish => {
          if (dish.name) {
            const dishLower = dish.name.toLowerCase();
            if (dishLower.includes(queryLower)) {
              let score = distanceScore * 2;
              if (dishLower === queryLower) score += 1000;
              else if (dishLower.startsWith(queryLower)) score += 500;
              else score += 100;

              if (!grouped.dishes.has(dish.name) || grouped.dishes.get(dish.name).score < score) {
                grouped.dishes.set(dish.name, { name: dish.name, cuisine: dish.cuisine, score });
              }
            }
          }
        });
      }

      // Extract matching cuisines
      if (doc.cuisine && Array.isArray(doc.cuisine)) {
        doc.cuisine.forEach(cuisine => {
          const cuisineLower = cuisine.toLowerCase();
          if (cuisineLower.includes(queryLower)) {
            let score = distanceScore * 2;
            if (cuisineLower === queryLower) score += 1000;
            else if (cuisineLower.startsWith(queryLower)) score += 500;
            else score += 100;

            if (!grouped.cuisines.has(cuisine) || grouped.cuisines.get(cuisine).score < score) {
              grouped.cuisines.set(cuisine, { name: cuisine, score });
            }
          }
        });
      }
    });

    // Display grouped results
    console.log('=== BUSINESSES ===');
    const businesses = Array.from(grouped.businesses.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    businesses.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name} - ${(b.distance / 1000).toFixed(2)}km (score: ${b.score.toFixed(2)})`);
    });

    console.log('\n=== DISHES ===');
    const dishes = Array.from(grouped.dishes.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    dishes.forEach((d, i) => {
      console.log(`${i + 1}. ${d.name} - ${d.cuisine || 'N/A'} (score: ${d.score.toFixed(2)})`);
    });

    console.log('\n=== CUISINES ===');
    const cuisines = Array.from(grouped.cuisines.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    cuisines.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (score: ${c.score.toFixed(2)})`);
    });

    console.log('\n=== Summary ===');
    console.log(`Businesses: ${businesses.length}`);
    console.log(`Dishes: ${dishes.length}`);
    console.log(`Cuisines: ${cuisines.length}`);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nConnection closed');
  }
}

testAutocompleteGeo();
