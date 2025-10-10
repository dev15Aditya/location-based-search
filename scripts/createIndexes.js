const mongoose = require('mongoose');
require('dotenv').config();

// Import models to ensure indexes are created
const Business = require('../models/Business');
const Location = require('../models/Location');
const Deal = require('../models/Deal');

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB Atlas');
    console.log('Creating additional indexes for search optimization...');

    // Create additional indexes for businesses
    await Business.collection.createIndex({
      businessName: 'text',
      tags: 'text',
      state: 'text'
    }, { name: 'business_search_text' });
    console.log('✓ Business text search index created');

    // Create additional indexes for deals
    await Deal.collection.createIndex({
      offerName: 'text',
      description: 'text',
      menu: 'text',
      course: 'text',
      cuisine: 'text',
      categoryName: 'text',
      tags: 'text'
    }, { name: 'deal_search_text' });
    console.log('✓ Deal text search index created');

    // Create compound indexes for better performance
    await Deal.collection.createIndex({
      status: 1,
      promoEndDate: 1,
      offer: -1
    }, { name: 'deal_active_sorted' });
    console.log('✓ Deal active sorted index created');

    await Business.collection.createIndex({
      active: 1,
      dealsCount: -1,
      priority: -1
    }, { name: 'business_active_sorted' });
    console.log('✓ Business active sorted index created');

    console.log('All search indexes created successfully!');
    
    // List indexes for the target collections
    const targetCollections = ['businesses', 'deals', 'locations'];
    
    for (const collectionName of targetCollections) {
      try {
        const indexes = await mongoose.connection.db.collection(collectionName).indexes();
        console.log(`\n${collectionName} indexes:`);
        indexes.forEach(index => {
          console.log(`  - ${JSON.stringify(index.key)} (${index.name})`);
        });
      } catch (error) {
        console.log(`Collection ${collectionName} not found or error: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
};

createIndexes();