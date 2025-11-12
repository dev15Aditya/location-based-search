require('dotenv').config();
const mongoose = require('mongoose');
const SearchIndex = require('../models/SearchIndex');

async function testQuery(query, lat, lng, maxDistance) {
  const queryLower = query.toLowerCase();
  
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
    { $limit: 100 }
  ];

  const results = await SearchIndex.aggregate(pipeline);

  const grouped = {
    businesses: new Map(),
    dishes: new Map(),
    cuisines: new Map()
  };

  results.forEach(doc => {
    const distanceScore = Math.max(0, 100 - (doc.distance / maxDistance) * 100);

    if (doc.businessName) {
      const nameLower = doc.businessName.toLowerCase();
      if (nameLower.includes(queryLower)) {
        let score = distanceScore * 3;
        if (nameLower === queryLower) score += 1000;
        else if (nameLower.startsWith(queryLower)) score += 500;
        else score += 100;

        if (!grouped.businesses.has(doc.businessName) || grouped.businesses.get(doc.businessName).score < score) {
          grouped.businesses.set(doc.businessName, { name: doc.businessName, score });
        }
      }
    }

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

  return {
    businesses: Array.from(grouped.businesses.values()).sort((a, b) => b.score - a.score).slice(0, 10).map(b => b.name),
    dishes: Array.from(grouped.dishes.values()).sort((a, b) => b.score - a.score).slice(0, 10).map(d => d.name),
    cuisines: Array.from(grouped.cuisines.values()).sort((a, b) => b.score - a.score).slice(0, 10).map(c => c.name)
  };
}

async function runTests() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const lat = 47.6062;
    const lng = -122.3321;
    const maxDistance = 50000;

    const queries = ['gru', 'gar', 'american', 'salad', 'byte'];

    for (const query of queries) {
      console.log(`\n=== Query: "${query}" ===`);
      const result = await testQuery(query, lat, lng, maxDistance);
      
      console.log(`Businesses: [${result.businesses.join(', ')}]`);
      console.log(`Dishes: [${result.dishes.join(', ')}]`);
      console.log(`Cuisines: [${result.cuisines.join(', ')}]`);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n\nConnection closed');
  }
}

runTests();
