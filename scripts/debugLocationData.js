const mongoose = require('mongoose');
const Business = require('../models/Business');
const Location = require('../models/Location');
require('dotenv').config();

const debugLocationData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test coordinates (Seattle area)
    const testLat = 47.603243;
    const testLng = -122.330286;
    const testRadius = 5000; // 5km

    console.log('\n=== DEBUGGING LOCATION DATA ===');
    console.log(`Test coordinates: ${testLat}, ${testLng}`);
    console.log(`Test radius: ${testRadius}m`);

    // 1. Find Nike businesses
    console.log('\n1. Finding Nike businesses...');
    const nikeBusinesses = await Business.find({
      businessName: { $regex: 'Nike', $options: 'i' },
      active: true
    }).select('_id businessName').lean();
    
    console.log(`Found ${nikeBusinesses.length} Nike businesses:`);
    nikeBusinesses.forEach(b => console.log(`  - ${b.businessName} (${b._id})`));

    if (nikeBusinesses.length === 0) {
      console.log('No Nike businesses found. Exiting...');
      return;
    }

    const businessIds = nikeBusinesses.map(b => b._id);

    // 2. Check all locations for these businesses
    console.log('\n2. Checking all locations for Nike businesses...');
    const allLocations = await Location.find({
      businessId: { $in: businessIds }
    }).select('businessId address city state latitude longitude loc geoLocation isAvailable').lean();
    
    console.log(`Found ${allLocations.length} total locations for Nike businesses:`);
    allLocations.forEach((loc, i) => {
      console.log(`  ${i + 1}. Business: ${loc.businessId}`);
      console.log(`     Address: ${loc.address}, ${loc.city}, ${loc.state}`);
      console.log(`     Available: ${loc.isAvailable}`);
      console.log(`     Latitude: ${loc.latitude} (type: ${typeof loc.latitude})`);
      console.log(`     Longitude: ${loc.longitude} (type: ${typeof loc.longitude})`);
      console.log(`     Loc array: ${JSON.stringify(loc.loc)}`);
      console.log(`     GeoLocation: ${JSON.stringify(loc.geoLocation)}`);
      console.log('     ---');
    });

    // 3. Check available locations only
    console.log('\n3. Checking available locations only...');
    const availableLocations = await Location.find({
      businessId: { $in: businessIds },
      isAvailable: true
    }).select('businessId address city state latitude longitude').lean();
    
    console.log(`Found ${availableLocations.length} available locations`);

    // 4. Test different geospatial queries
    console.log('\n4. Testing geospatial queries...');
    
    // Test with geoLocation field
    try {
      const geoResults = await Location.find({
        businessId: { $in: businessIds },
        isAvailable: true,
        geoLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [testLng, testLat]
            },
            $maxDistance: testRadius
          }
        }
      }).limit(10).lean();
      
      console.log(`GeoLocation query found: ${geoResults.length} locations`);
    } catch (error) {
      console.log(`GeoLocation query failed: ${error.message}`);
    }

    // Test with loc field
    try {
      const locResults = await Location.find({
        businessId: { $in: businessIds },
        isAvailable: true,
        loc: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [testLng, testLat]
            },
            $maxDistance: testRadius
          }
        }
      }).limit(10).lean();
      
      console.log(`Loc field query found: ${locResults.length} locations`);
    } catch (error) {
      console.log(`Loc field query failed: ${error.message}`);
    }

    // Test string comparison with proper conversion
    try {
      const radiusInDegrees = testRadius / 111000;
      const stringResults = await Location.find({
        businessId: { $in: businessIds },
        isAvailable: true,
        $expr: {
          $and: [
            { $gte: [{ $toDouble: "$latitude" }, testLat - radiusInDegrees] },
            { $lte: [{ $toDouble: "$latitude" }, testLat + radiusInDegrees] },
            { $gte: [{ $toDouble: "$longitude" }, testLng - radiusInDegrees] },
            { $lte: [{ $toDouble: "$longitude" }, testLng + radiusInDegrees] }
          ]
        }
      }).limit(10).lean();
      
      console.log(`String comparison query found: ${stringResults.length} locations`);
    } catch (error) {
      console.log(`String comparison query failed: ${error.message}`);
    }

    // 5. Sample a few locations to check coordinate formats
    console.log('\n5. Sampling coordinate formats...');
    const sampleLocations = await Location.find({}).limit(5).lean();
    sampleLocations.forEach((loc, i) => {
      console.log(`Sample ${i + 1}:`);
      console.log(`  Latitude: "${loc.latitude}" (${typeof loc.latitude})`);
      console.log(`  Longitude: "${loc.longitude}" (${typeof loc.longitude})`);
      console.log(`  Loc: ${JSON.stringify(loc.loc)}`);
      console.log(`  GeoLocation: ${JSON.stringify(loc.geoLocation)}`);
    });

  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
};

debugLocationData();