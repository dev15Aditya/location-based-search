const mongoose = require('mongoose');
const Business = require('../models/Business');
const Location = require('../models/Location');
const Deal = require('../models/Deal');

const searchFood = async (req, res) => {
  try {
    const {
      query,
      latitude,
      longitude,
      radius = 10000,
      limit = 20,
      type
    } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('Search request:', { query, latitude, longitude, radius, limit, type });

    const results = {
      businesses: [],
      deals: [],
      total: 0
    };

    if (!type || type === 'business') {
      const businessResults = await searchBusinessesSimple(query, latitude, longitude, radius, limit);
      results.businesses = businessResults;
    }

    if (!type || type === 'deal' || type === 'food') {
      const dealResults = await searchDealsSimple(query, latitude, longitude, radius, limit);
      results.deals = dealResults;
    }

    results.total = results.businesses.length + results.deals.length;

    res.json({
      success: true,
      query,
      location: latitude && longitude ? { latitude, longitude, radius } : null,
      results
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

const searchBusinessesSimple = async (query, latitude, longitude, radius, limit) => {
  try {
    console.log('Searching businesses for:', query);

    if (latitude && longitude) {
      return await searchBusinessesByLocation(query, latitude, longitude, radius, limit);
    }

    const businesses = await Business.aggregate([
      {
        $search: {
          index: 'business_search',
          compound: {
            must: [
              {
                text: {
                  query: query,
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
      {
        $sort: {
          searchScore: -1,
          dealsCount: -1
        }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          businessName: 1,
          businessLogoUrl: 1,
          slug: 1,
          searchScore: 1
        }
      }
    ]);

    console.log('Atlas Search found businesses:', businesses.length);

    return businesses.map(business => ({
      ...business,
      // locations: [],
      type: 'business'
    }));

  } catch (error) {
    console.error('Business search error:', error);
    return [];
  }
};

const searchBusinessesByLocation = async (query, latitude, longitude, radius, limit) => {
  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusInMeters = parseInt(radius);

    console.log(`Location-based search: ${query} near ${lat}, ${lng} within ${radiusInMeters}m`);

    let nearbyLocations = [];

    try {
      nearbyLocations = await Location.find({
        isAvailable: true,
        geoLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            $maxDistance: radiusInMeters
          }
        }
      })
        .select('businessId address city state latitude longitude')
        .limit(1000)
        .lean();

      console.log('Geospatial query found nearby locations:', nearbyLocations.length);
    } catch (geoError) {
      console.log('Geospatial query failed, trying loc field:', geoError.message);

      try {
        nearbyLocations = await Location.find({
          isAvailable: true,
          loc: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [lng, lat]
              },
              $maxDistance: radiusInMeters
            }
          }
        })
          .select('businessId address city state latitude longitude')
          .limit(1000)
          .lean();

        console.log('Loc field query found nearby locations:', nearbyLocations.length);
      } catch (locError) {
        console.log('Loc field failed, using bounding box:', locError.message);

        const radiusInDegrees = radiusInMeters / 111000;
        nearbyLocations = await Location.find({
          isAvailable: true,
          $expr: {
            $and: [
              { $gte: [{ $toDouble: "$latitude" }, lat - radiusInDegrees] },
              { $lte: [{ $toDouble: "$latitude" }, lat + radiusInDegrees] },
              { $gte: [{ $toDouble: "$longitude" }, lng - radiusInDegrees] },
              { $lte: [{ $toDouble: "$longitude" }, lng + radiusInDegrees] }
            ]
          }
        })
          .select('businessId address city state latitude longitude')
          .limit(1000)
          .lean();

        console.log('Bounding box found nearby locations:', nearbyLocations.length);
      }
    }

    if (nearbyLocations.length === 0) {
      console.log('No locations found in the specified area');
      return [];
    }

    const nearbyBusinessIds = [...new Set(nearbyLocations.map(loc => loc.businessId.toString()))];
    console.log('Found businesses with nearby locations:', nearbyBusinessIds.length);

    // const matchingBusinesses = await Business.aggregate([
    //   {
    //     $search: {
    //       index: 'business_search',
    //       text: {
    //         query: query,
    //         path: ['businessName', 'tags'],
    //         fuzzy: { maxEdits: 2 }
    //       }
    //     }
    //   },
    //   {
    //     $match: {
    //       _id: { $in: nearbyBusinessIds.map(id => new mongoose.Types.ObjectId(id)) },
    //       active: true
    //     }
    //   },
    //   {
    //     $addFields: {
    //       searchScore: { $meta: "searchScore" }
    //     }
    //   },
    //   { $sort: { searchScore: -1, dealsCount: -1 } },
    //   { $limit: parseInt(limit) }
    // ]);

    let matchingBusinesses = await Business.aggregate([
      {
        $search: {
          index: 'business_search',
          compound: {
            should: [
              {
                text: {
                  query: query,
                  path: 'businessName',
                  fuzzy: { maxEdits: 2, prefixLength: 1 },
                  score: { boost: { value: 3 } }
                }
              },
              {
                text: {
                  query: query,
                  path: 'tags',
                  fuzzy: { maxEdits: 2 },
                  score: { boost: { value: 1.5 } }
                }
              },
              // {
              //   autocomplete: {
              //     query: query,
              //     path: 'businessName',
              //     fuzzy: { maxEdits: 1 }
              //   }
              // }
            ],
            minimumShouldMatch: 1
          }
        }
      },
      {
        $match: {
          _id: { $in: nearbyBusinessIds.map(id => new mongoose.Types.ObjectId(id)) },
          active: true
        }
      },
      {
        $project: {
          _id: 1,
          businessName: 1,
          // businessLogoUrl: 1,
          // coverImgUrl: 1,
          // slug: 1,
          tags: 1,
          // dealsCount: 1,
          description: 1
        }
      }
    ])


    console.log('Atlas Search found matching nearby businesses:', matchingBusinesses);

    const businessesWithLocations = matchingBusinesses.map(business => {
      const businessLocations = nearbyLocations.filter(
        loc => loc.businessId.toString() === business._id.toString()
      );

      return {
        ...business,
        // locations: businessLocations,
        // type: 'business'
      };
    });

    console.log('Final location-based results:', businessesWithLocations.length);
    return businessesWithLocations;

  } catch (error) {
    console.error('Location-based search error:', error);
    return [];
  }
};

const searchDealsSimple = async (query, latitude, longitude, radius, limit) => {
  try {
    console.log('Searching deals for:', query);

    if (latitude && longitude) {
      return await searchDealsByLocation(query, latitude, longitude, radius, limit);
    }

    const currentDate = new Date();

    const deals = await Deal.aggregate([
      {
        $search: {
          index: 'deal_search',
          compound: {
            must: [
              {
                text: {
                  query: query,
                  path: ['offerName', 'description', 'menu', 'course', 'cuisine'],
                  fuzzy: { maxEdits: 2 }
                }
              }
            ],
            filter: [
              {
                equals: {
                  path: 'status',
                  value: 'active'
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          $or: [
            { promoEndDate: { $exists: false } },
            { promoEndDate: { $gte: currentDate } }
          ]
        }
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' }
        }
      },
      {
        $sort: {
          searchScore: -1,
          offer: -1
        }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          offerName: 1,
          description: 1,
          offer: 1,
          businessId: 1,
          slug: 1,
          promoStartDate: 1,
          promoEndDate: 1
        }
      }
    ]);

    console.log('Atlas Search found deals:', deals.length);

    const businessIds = deals.map(d => d.businessId);
    const businesses = await Business.find({
      _id: { $in: businessIds }
    }).select('businessName businessLogoUrl slug').lean();

    return deals.map(deal => {
      const business = businesses.find(b => b._id.toString() === deal.businessId.toString());
      return {
        ...deal,
        business,
        locations: [],
        type: 'deal'
      };
    });

  } catch (error) {
    console.error('Deal search error:', error);
    return [];
  }
};

const searchDealsByLocation = async (query, latitude, longitude, radius, limit) => {
  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radiusInMeters = parseInt(radius);
    const currentDate = new Date();

    console.log(`Location-based deal search: ${query} near ${lat}, ${lng} within ${radiusInMeters}m`);

    let nearbyLocations = [];

    try {
      nearbyLocations = await Location.find({
        isAvailable: true,
        geoLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat]
            },
            $maxDistance: radiusInMeters
          }
        }
      })
        .select('businessId address city state latitude longitude')
        .limit(1000)
        .lean();

      console.log('Found nearby locations for deals:', nearbyLocations.length);
    } catch (geoError) {
      try {
        nearbyLocations = await Location.find({
          isAvailable: true,
          loc: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [lng, lat]
              },
              $maxDistance: radiusInMeters
            }
          }
        })
          .select('businessId address city state latitude longitude')
          .limit(1000)
          .lean();
      } catch (locError) {
        const radiusInDegrees = radiusInMeters / 111000;
        nearbyLocations = await Location.find({
          isAvailable: true,
          $expr: {
            $and: [
              { $gte: [{ $toDouble: "$latitude" }, lat - radiusInDegrees] },
              { $lte: [{ $toDouble: "$latitude" }, lat + radiusInDegrees] },
              { $gte: [{ $toDouble: "$longitude" }, lng - radiusInDegrees] },
              { $lte: [{ $toDouble: "$longitude" }, lng + radiusInDegrees] }
            ]
          }
        })
          .select('businessId address city state latitude longitude')
          .limit(1000)
          .lean();
      }
    }

    if (nearbyLocations.length === 0) {
      console.log('No locations found for deals in the specified area');
      return [];
    }

    const nearbyBusinessIds = [...new Set(nearbyLocations.map(loc => loc.businessId.toString()))];
    console.log('Found businesses with nearby locations for deals:', nearbyBusinessIds.length);

    const matchingDeals = await Deal.aggregate([
      {
        $search: {
          index: 'deal_search',
          compound: {
            must: [
              {
                text: {
                  query: query,
                  path: ['offerName', 'description', 'menu', 'course', 'cuisine'],
                  fuzzy: { maxEdits: 2 }
                }
              }
            ],
            filter: [
              {
                equals: {
                  path: 'status',
                  value: 'active'
                }
              }
            ]
          }
        }
      },
      {
        $match: {
          businessId: { $in: nearbyBusinessIds.map(id => new mongoose.Types.ObjectId(id)) },
          $or: [
            { promoEndDate: { $exists: false } },
            { promoEndDate: { $gte: currentDate } }
          ]
        }
      },
      {
        $addFields: {
          searchScore: { $meta: 'searchScore' }
        }
      },
      {
        $sort: {
          searchScore: -1,
          offer: -1
        }
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          _id: 1,
          offerName: 1,
          description: 1,
          offer: 1,
          businessId: 1,
          slug: 1,
          promoStartDate: 1,
          promoEndDate: 1
        }
      }
    ]);

    console.log('Atlas Search found matching nearby deals:', matchingDeals.length);

    const businessIds = matchingDeals.map(d => d.businessId);
    const businesses = await Business.find({
      _id: { $in: businessIds }
    }).select('businessName businessLogoUrl slug').lean();

    const dealsWithData = matchingDeals.map(deal => {
      const business = businesses.find(b => b._id.toString() === deal.businessId.toString());
      const dealLocations = nearbyLocations.filter(
        loc => loc.businessId.toString() === deal.businessId.toString()
      );

      return {
        ...deal,
        business,
        locations: dealLocations,
        type: 'deal'
      };
    });

    console.log('Final location-based deal results:', dealsWithData.length);
    return dealsWithData;

  } catch (error) {
    console.error('Location-based deal search error:', error);
    return [];
  }
};

module.exports = {
  searchFood
};
