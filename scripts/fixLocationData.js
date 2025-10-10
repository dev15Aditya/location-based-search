const mongoose = require('mongoose');
require('dotenv').config();

const fixLocationData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB Atlas');
        console.log('Adding geoLocation field to locations...');

        // Check current format
        const sampleLocation = await mongoose.connection.db.collection('locations').findOne();
        console.log('Sample location before fix:');
        console.log('  loc:', JSON.stringify(sampleLocation.loc, null, 2));
        console.log('  geoLocation:', JSON.stringify(sampleLocation.geoLocation, null, 2));

        // Count locations that need geoLocation field
        const locationsToFix = await mongoose.connection.db.collection('locations').countDocuments({
            geoLocation: { $exists: false },
            loc: { $exists: true, $type: "array" }
        });
        console.log(`Found ${locationsToFix} locations that need geoLocation field`);

        if (locationsToFix === 0) {
            console.log('No locations need fixing - geoLocation field already exists');
            return;
        }

        // Add geoLocation field based on existing loc array
        let fixedCount = 0;
        const cursor = mongoose.connection.db.collection('locations').find({
            geoLocation: { $exists: false },
            loc: { $exists: true, $type: "array" }
        });

        while (await cursor.hasNext()) {
            const doc = await cursor.next();

            if (Array.isArray(doc.loc) && doc.loc.length === 2) {
                const [longitude, latitude] = doc.loc;

                // Add new geoLocation field in GeoJSON format (keep original loc intact)
                await mongoose.connection.db.collection('locations').updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            geoLocation: {
                                type: "Point",
                                coordinates: [longitude, latitude]
                            }
                        }
                    }
                );

                fixedCount++;
                if (fixedCount % 100 === 0) {
                    console.log(`Added geoLocation to ${fixedCount} locations...`);
                }
            }
        }

        console.log(`✓ Added geoLocation field to ${fixedCount} locations`);

        // Create 2dsphere index on geoLocation
        try {
            await mongoose.connection.db.collection('locations').createIndex({ geoLocation: "2dsphere" });
            console.log('✓ Created 2dsphere index on geoLocation field');
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('✓ 2dsphere index on geoLocation already exists');
            } else {
                console.error('Error creating geoLocation index:', error.message);
            }
        }

        // Verify the fix
        const sampleFixed = await mongoose.connection.db.collection('locations').findOne();
        console.log('Sample location after fix:');
        console.log('  loc (original):', JSON.stringify(sampleFixed.loc, null, 2));
        console.log('  geoLocation (new):', JSON.stringify(sampleFixed.geoLocation, null, 2));

        // Test geospatial query on new field
        console.log('Testing geospatial query on geoLocation field...');
        const testResults = await mongoose.connection.db.collection('locations').find({
            geoLocation: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [-122.330286, 47.603243] // Seattle coordinates
                    },
                    $maxDistance: 10000
                }
            }
        }).limit(5).toArray();

        console.log(`✓ Geospatial test found ${testResults.length} locations near Seattle`);

        console.log('\n🎉 Location data enhancement completed successfully!');
        console.log('✓ Original loc field preserved for existing functionality');
        console.log('✓ New geoLocation field added for geospatial searches');
        console.log('✓ Your search API will now work with proper geospatial queries');

    } catch (error) {
        console.error('Error fixing location data:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
};

fixLocationData();