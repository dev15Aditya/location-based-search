const Business = require('../models/Business');
const Location = require('../models/Location');

const testSearch = async (req, res) => {
  try {
    const { query } = req.query;
    
    console.log('Testing search for:', query);
    
    const results = {
      step1_totalBusinesses: 0,
      step2_activeBusinesses: 0,
      step3_matchingBusinesses: 0,
      step4_atlasSearch: 0,
      step5_locations: 0,
      step6_geoLocations: 0,
      businessSample: null,
      locationSample: null,
      businessNames: [],
      errors: []
    };

    // Step 1: Count total businesses
    results.step1_totalBusinesses = await Business.countDocuments();
    
    // Step 2: Count active businesses
    results.step2_activeBusinesses = await Business.countDocuments({ active: true });
    
    // Step 3: Find businesses matching the query (basic regex)
    const matchingBusinesses = await Business.find({
      businessName: { $regex: query, $options: 'i' }
    }).limit(5);
    results.step3_matchingBusinesses = matchingBusinesses.length;
    results.businessSample = matchingBusinesses[0] || null;
    
    // Get some sample business names to see what exists
    const sampleBusinesses = await Business.find({ active: true })
      .select('businessName')
      .limit(10);
    results.businessNames = sampleBusinesses.map(b => b.businessName);
    
    // Step 4: Try Atlas Search
    try {
      const atlasResults = await Business.aggregate([
        {
          $search: {
            index: 'business_search',
            text: {
              query: query,
              path: 'businessName'
            }
          }
        },
        { $limit: 5 }
      ]);
      results.step4_atlasSearch = atlasResults.length;
      results.atlasResults = atlasResults.map(r => ({
        businessName: r.businessName,
        active: r.active,
        searchScore: r.searchScore
      }));
    } catch (error) {
      results.errors.push(`Atlas Search Error: ${error.message}`);
    }
    
    // Step 5: Check locations (old format)
    results.step5_locations = await Location.countDocuments({ isAvailable: true });
    
    // Step 6: Check geoLocations (new format)
    results.step6_geoLocations = await Location.countDocuments({ 
      isAvailable: true,
      geoLocation: { $exists: true }
    });
    
    const sampleLocation = await Location.findOne({ isAvailable: true });
    results.locationSample = sampleLocation;
    
    // Step 7: Test geospatial query with geoLocation
    if (req.query.latitude && req.query.longitude) {
      try {
        const nearbyLocations = await Location.find({
          geoLocation: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(req.query.longitude), parseFloat(req.query.latitude)]
              },
              $maxDistance: parseInt(req.query.radius || 10000)
            }
          },
          isAvailable: true
        }).limit(5);
        results.nearbyLocations = nearbyLocations.length;
        results.nearbyLocationSample = nearbyLocations[0] || null;
      } catch (error) {
        results.errors.push(`Geospatial Error: ${error.message}`);
      }
    }

    res.json({
      success: true,
      query,
      results
    });

  } catch (error) {
    console.error('Test search error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message
    });
  }
};

module.exports = {
  testSearch
};