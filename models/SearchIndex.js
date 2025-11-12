const mongoose = require("mongoose");

const DishSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    cuisine: String,
    category: String,
    actualPrice: Number,
    offerPrice: Number,
    dishId: mongoose.Schema.Types.ObjectId,
  },
  { _id: false }
);

const LocationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
    address: String,
    city: String,
    state: String,
    zipCode: String,
    locationId: mongoose.Schema.Types.ObjectId,
  },
  { _id: false }
);

const SearchIndexSchema = new mongoose.Schema(
  {
    businessId: mongoose.Schema.Types.ObjectId,
    businessName: { type: String, required: true },
    businessLogoUrl: String,
    slug: String,
    tags: [String],
    location: LocationSchema,
    dishes: [DishSchema],
    cuisine: [String],
    dealsCount: Number,
  },
  { timestamps: true, collection: "search_index" } // <-- important
);

// 2dsphere index for location (for geo-based search fallback)
// SearchIndexSchema.index({ "location.coordinates": "2dsphere" });

const SearchIndex = mongoose.model("SearchIndex", SearchIndexSchema);
module.exports = SearchIndex;
