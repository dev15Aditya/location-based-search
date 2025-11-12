const mongoose = require('mongoose');
require('dotenv').config();

const Business = require('../models/Business');
const Location = require('../models/Location');
const Deal = require('../models/Deal');
const SearchIndex = require('../models/SearchIndex');

async function populateSeattleTestData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas\n');

    // Clear existing search index
    await SearchIndex.deleteMany({});
    console.log('Cleared existing search index\n');

    // Find locations in Seattle
    const seattleLocations = await Location.find({ 
      city: { $regex: /seattle/i },
      isAvailable: true 
    })
    .limit(20)
    .lean();

    console.log(`Found ${seattleLocations.length} locations in Seattle\n`);

    if (seattleLocations.length === 0) {
      console.log('No Seattle locations found. Trying with state filter...');
      const waLocations = await Location.find({ 
        state: { $regex: /wa|washington/i },
        isAvailable: true 
      })
      .limit(20)
      .lean();
      
      console.log(`Found ${waLocations.length} locations in Washington state\n`);
      seattleLocations.push(...waLocations);
    }

    let recordCount = 0;
    const searchDocs = [];

    for (const location of seattleLocations) {
      // Get business details
      const business = await Business.findById(location.businessId).lean();
      
      if (!business) {
        console.log(`Business not found for location ${location._id}`);
        continue;
      }

      // Get deals for this business
      const deals = await Deal.find({ 
        businessId: business._id,
        status: { $ne: 'inactive' }
      }).lean();

      // Extract unique cuisines
      const cuisines = [...new Set(
        deals
          .map(deal => deal.cuisine)
          .filter(cuisine => cuisine && cuisine.trim() !== '')
      )];

      // Create dishes array
      const dishes = deals.map(deal => ({
        name: deal.offerName,
        description: deal.description,
        cuisine: deal.cuisine,
        actualPrice: deal.actualPrice,
        offerPrice: deal.offerPrice,
        category: deal.categoryName,
        dishId: deal._id
      }));

      // Prepare coordinates
      let coordinates = [0, 0];
      
      if (location.geoLocation?.coordinates && location.geoLocation.coordinates.length === 2) {
        coordinates = location.geoLocation.coordinates;
      } else if (location.longitude && location.latitude) {
        coordinates = [parseFloat(location.longitude), parseFloat(location.latitude)];
      } else if (location.loc && location.loc.length === 2) {
        coordinates = location.loc;
      }

      // Create search document
      const searchDoc = {
        businessId: business._id,
        businessName: business.businessName,
        businessLogoUrl: business.businessLogoUrl,
        businessType: business.businessType || [],
        slug: business.slug,
        tags: business.tags || [],
        
        location: {
          type: 'Point',
          coordinates: coordinates,
          address: location.address,
          city: location.city,
          state: location.state,
          zipCode: location.zipCode,
          locationId: location._id
        },
        
        dishes: dishes,
        cuisine: cuisines,
        dealsCount: deals.length,
        menuId: location.menuId
      };

      const created = await SearchIndex.create(searchDoc);
      searchDocs.push(created);
      recordCount++;

      console.log(`${recordCount}. ${business.businessName}`);
      console.log(`   Location: ${location.city}, ${location.state}`);
      console.log(`   Coordinates: [${coordinates[0]}, ${coordinates[1]}]`);
      console.log(`   Dishes: ${dishes.length}, Cuisines: ${cuisines.length}`);
      console.log('');
    }

    console.log(`\n✓ Total search documents created: ${recordCount}\n`);

    // Print summary
    console.log('=== SUMMARY ===');
    console.log(`Total records: ${recordCount}`);
    console.log(`Unique businesses: ${new Set(searchDocs.map(d => d.businessId.toString())).size}`);
    console.log(`Total dishes: ${searchDocs.reduce((sum, d) => sum + d.dishes.length, 0)}`);
    console.log(`Unique cuisines: ${new Set(searchDocs.flatMap(d => d.cuisine)).size}`);
    
    console.log('\n=== SAMPLE DOCUMENT ===');
    if (searchDocs.length > 0) {
      console.log(JSON.stringify(searchDocs[0], null, 2));
    }

  } catch (error) {
    console.error('Error populating search index:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

populateSeattleTestData();
