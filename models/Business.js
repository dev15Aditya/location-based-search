const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
    index: true
  },
  businessLogoUrl: String,
  coverImgUrl: String,
  businessStatus: String,
  businessType: [Buffer],
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: Number,
  dealsCount: {
    type: Number,
    index: true
  },
  noOfStores: Number,
  slug: {
    type: String,
    index: true
  },
  tags: [String],
  state: [String],
  cards: [String],
  couponsCount: Number,
  dealSpecificCouponCount: Number,
  businessLocations: [],
  store: [],
  CardOffer: [],
  GenericDeals: [],
  businessProfileActivity: [],
  categoriesWithData: [],
  subCategoriesWithData: [],
  preferredCard: [{
    totalRewardScore: Number,
    cardId: mongoose.Schema.Types.ObjectId,
    relatedCategories: mongoose.Schema.Types.Mixed,
    cardName: String,
    imageUrl: String,
    shortRewardDesc: String,
    slug: String,
    network: String,
    rank: Number
  }],
  businessVerifiedBy: [],
  _sv: Number,
  __v: Number
}, {
  collection: 'stores',
  autoIndex: false // Disable automatic index creation
});

// Atlas Search indexes are managed in MongoDB Atlas UI
// Regular indexes are managed manually in Atlas
// Do not create indexes automatically

module.exports = mongoose.model('Business', businessSchema);