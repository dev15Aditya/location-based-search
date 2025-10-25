const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  businessName: String,
  menuId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  itemCategoryId: mongoose.Schema.Types.ObjectId,
  offerName: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  menu: String,
  course: String,
  cuisine: String,
  categoryName: String,
  category: [Buffer],
  actualPrice: Number,
  offerPrice: Number,
  offer: Number,
  isPercentageOff: Boolean,
  offerImageUrl: String,
  offerSource: String,
  status: {
    type: String,
    index: true
  },
  promoStartDate: Date,
  promoEndDate: Date,
  rating: Number,
  ratedBy: Number,
  slug: String,
  uniqueIdentifier: String,
  tags: [String],
  seo: {
    title: String,
    description: String
  },
  createdAt: Date,
  updatedAt: Date,
  lastUpdated: Date,
  tagUpdateAttemptedAt: Date,
  tagUpdateStatus: String,
  tagsUpdatedAt: Date,
  embedding: [mongoose.Schema.Types.Mixed],
  embeddingUpdatedAt: Date,
  __v: Number
}, {
  collection: 'deals',
  autoIndex: false // Disable automatic index creation
});

// Atlas Search indexes are managed in MongoDB Atlas UI
// Regular indexes are managed manually in Atlas
// Do not create indexes automatically

module.exports = mongoose.model('Deal', dealSchema);