const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true,
    index: true
  },
  address: String,
  latitude: String,
  longitude: String,
  loc: [Number], // Keep existing format [longitude, latitude]
  geoLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] - GeoJSON format
      index: '2dsphere'
    }
  },
  state: String,
  lane: String,
  city: String,
  country: String,
  countryCode: String,
  zipCode: String,
  h3cell: String,
  menuId: mongoose.Schema.Types.ObjectId,
  isAvailable: {
    type: Boolean,
    default: true
  },
  timings: {
    day: [],
    open: String,
    close: String
  },
  categoryId: [],
  createdAt: Date,
  updatedAt: Date,
  __v: Number
}, {
  collection: 'locations'
});

// Keep existing index and add new geospatial index
locationSchema.index({ loc: '2dsphere', businessId: 1 }); // Existing index
locationSchema.index({ geoLocation: '2dsphere' }); // New GeoJSON index

module.exports = mongoose.model('Location', locationSchema);