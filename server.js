const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch((error) => console.error('MongoDB connection error:', error));

// Routes
const searchRoutes = require('./routes/search');
const testRoutes = require('./routes/test');
const atlasTestRoutes = require('./routes/atlasTest');
app.use('/api/search', searchRoutes);
app.use('/api/test', testRoutes);
app.use('/api/atlas-test', atlasTestRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Food Search API with MongoDB Atlas',
    endpoints: {
      search: '/api/search?query=pizza&latitude=40.7128&longitude=-74.0060&radius=5000&limit=10&type=business'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});