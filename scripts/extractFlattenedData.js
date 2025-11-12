const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const Business = require('../models/Business');
const Location = require('../models/Location');
const Deal = require('../models/Deal');

async function extractFlattenedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas');

    const flattenedData = [];
    let recordCount = 0;
    const targetRecords = 400;

    // Get active businesses with locations
    const businesses = await Business.find({ active: true })
      .limit(100)
      .lean();

    console.log(`Found ${businesses.length} businesses`);

    for (const business of businesses) {
      if (recordCount >= targetRecords) break;

      // Get locations for this business
      const locations = await Location.find({ 
        businessId: business._id,
        isAvailable: true 
      }).lean();

      if (locations.length === 0) continue;

      // Get deals/menu items for this business
      const deals = await Deal.find({ 
        businessId: business._id,
        status: { $ne: 'inactive' }
      }).lean();

      // Extract unique cuisines from deals
      const cuisines = [...new Set(
        deals
          .map(deal => deal.cuisine)
          .filter(cuisine => cuisine && cuisine.trim() !== '')
      )];

      // Create dishes array with relevant info
      const dishes = deals.map(deal => ({
        name: deal.offerName,
        description: deal.description,
        menu: deal.menu,
        course: deal.course,
        cuisine: deal.cuisine,
        actualPrice: deal.actualPrice,
        offerPrice: deal.offerPrice,
        offer: deal.offer,
        category: deal.categoryName
      }));

      // Create one record for each location
      for (const location of locations) {
        if (recordCount >= targetRecords) break;

        const record = {
          businessId: business._id.toString(),
          businessName: business.businessName,
          businessLogoUrl: business.businessLogoUrl || '',
          businessType: business.businessType || [],
          slug: business.slug || '',
          tags: business.tags || [],
          location: {
            address: location.address || '',
            city: location.city || '',
            state: location.state || '',
            country: location.country || '',
            zipCode: location.zipCode || '',
            latitude: location.latitude || (location.geoLocation?.coordinates?.[1] || ''),
            longitude: location.longitude || (location.geoLocation?.coordinates?.[0] || ''),
            isAvailable: location.isAvailable
          },
          dishes: dishes,
          cuisine: cuisines,
          dealsCount: deals.length,
          menuId: location.menuId?.toString() || ''
        };

        flattenedData.push(record);
        recordCount++;

        if (recordCount % 50 === 0) {
          console.log(`Processed ${recordCount} records...`);
        }
      }
    }

    console.log(`\nTotal records extracted: ${flattenedData.length}`);

    // Save to JSON file
    const outputPath = 'flattened_data.json';
    fs.writeFileSync(
      outputPath,
      JSON.stringify(flattenedData, null, 2),
      'utf8'
    );

    console.log(`Data saved to ${outputPath}`);
    console.log(`\nSample record structure:`);
    console.log(JSON.stringify(flattenedData[0], null, 2));

    // Print statistics
    console.log(`\n--- Statistics ---`);
    console.log(`Total records: ${flattenedData.length}`);
    console.log(`Unique businesses: ${new Set(flattenedData.map(r => r.businessId)).size}`);
    console.log(`Total dishes across all records: ${flattenedData.reduce((sum, r) => sum + r.dishes.length, 0)}`);
    console.log(`Unique cuisines: ${new Set(flattenedData.flatMap(r => r.cuisine)).size}`);

  } catch (error) {
    console.error('Error extracting data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

extractFlattenedData();
