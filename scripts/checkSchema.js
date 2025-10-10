const mongoose = require('mongoose');
require('dotenv').config();

const checkExistingSchema = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB Atlas');
        console.log('Checking food search collections...\n');

        // Target collections for food search
        const targetCollections = ['businesses', 'deals', 'menus', 'locations'];

        // Check each target collection
        for (const collectionName of targetCollections) {
            console.log(`\n=== ${collectionName.toUpperCase()} ===`);

            try {
                // Check if collection exists
                const collections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
                if (collections.length === 0) {
                    console.log(`Collection '${collectionName}' does not exist`);
                    continue;
                }

                // Get sample document to understand schema
                const sampleDoc = await mongoose.connection.db.collection(collectionName).findOne();
                if (sampleDoc) {
                    console.log('Sample document structure:');
                    // Show only field names and types for cleaner output
                    const structure = getDocumentStructure(sampleDoc);
                    console.log(JSON.stringify(structure, null, 2));
                } else {
                    console.log('No documents found in this collection');
                }

                // Get existing indexes
                const indexes = await mongoose.connection.db.collection(collectionName).indexes();
                console.log('\nExisting indexes:');
                indexes.forEach(index => {
                    console.log(`  - ${JSON.stringify(index.key)} (${index.name})`);
                });

                // Get document count
                const count = await mongoose.connection.db.collection(collectionName).countDocuments();
                console.log(`Document count: ${count}`);

            } catch (error) {
                console.error(`Error checking ${collectionName}:`, error.message);
            }
        }

    } catch (error) {
        console.error('Error connecting to database:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
};

// Helper function to get document structure without actual values
const getDocumentStructure = (doc, maxDepth = 2, currentDepth = 0) => {
    if (currentDepth >= maxDepth) return '...';

    const structure = {};
    for (const [key, value] of Object.entries(doc)) {
        if (value === null) {
            structure[key] = 'null';
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                structure[key] = [getDocumentStructure(value[0], maxDepth, currentDepth + 1)];
            } else {
                structure[key] = [];
            }
        } else if (typeof value === 'object' && value.constructor === Object) {
            structure[key] = getDocumentStructure(value, maxDepth, currentDepth + 1);
        } else {
            structure[key] = typeof value;
        }
    }
    return structure;
};

checkExistingSchema();