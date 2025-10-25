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
      type: [Number] // [longitude, latitude] - GeoJSON format
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
  collection: 'locations',
  autoIndex: false // Disable automatic index creation
});

// Indexes are managed in MongoDB Atlas
// Do not create indexes automatically

module.exports = mongoose.model('Location', locationSchema);