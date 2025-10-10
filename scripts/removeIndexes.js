const mongoose = require('mongoose');
require('dotenv').config();

const removeSearchIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB Atlas');
    console.log('Removing regular text search indexes...');

    // Remove text indexes we created
    try {
      await mongoose.connection.db.collection('businesses').dropIndex('business_search_text');
      console.log('✓ Removed business text search index');
    } catch (error) {
      console.log('Business text index not found or already removed');
    }

    try {
      await mongoose.connection.db.collection('deals').dropIndex('deal_search_text');
      console.log('✓ Removed deal text search index');
    } catch (error) {
      console.log('Deal text index not found or already removed');
    }

    try {
      await mongoose.connection.db.collection('deals').dropIndex('deal_active_sorted');
      console.log('✓ Removed deal active sorted index');
    } catch (error) {
      console.log('Deal active sorted index not found or already removed');
    }

    try {
      await mongoose.connection.db.collection('businesses').dropIndex('business_active_sorted');
      console.log('✓ Removed business active sorted index');
    } catch (error) {
      console.log('Business active sorted index not found or already removed');
    }

    console.log('Regular text indexes removed. Ready for Atlas Search!');

  } catch (error) {
    console.error('Error removing indexes:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

removeSearchIndexes();