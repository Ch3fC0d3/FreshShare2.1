const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { addUserToRequestAndLocals, requireAuthForPage } = require('./middleware/authJwt');

// Load environment variables from .env file
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB!');
    
    // Initialize database and start server
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Add event listeners for MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
  console.error('Error details:', {
    name: err.name,
    message: err.message,
    code: err.code,
    stack: err.stack
  });
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection disconnected');
});

// Add a process exit handler to close MongoDB connection
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error while closing MongoDB connection:', err);
    process.exit(1);
  }
});

// Initialize database with roles if needed
async function initializeDatabase() {
  try {
    const db = require('./models');
    const Role = db.role;
    
    const count = await Role.estimatedDocumentCount();
    
    if (count === 0) {
      await Promise.all([
        new Role({ name: "user" }).save(),
        new Role({ name: "moderator" }).save(),
        new Role({ name: "admin" }).save()
      ]);
      console.log('Added roles to database');
    }
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Global middleware to add user to locals for all views
app.use(addUserToRequestAndLocals);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public/uploads/marketplace');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/layout');

// API Routes with error handling
const asyncHandler = require('./utils/asyncHandler');

// Auth routes (both pages and API)
const authRoutes = require('./routes/auth.routes');

// Marketplace API routes
const marketplaceApiRoutes = require('./routes/api/marketplace');
app.use('/', authRoutes); // Mount at root for pages

// Other API routes
app.use('/api/marketplace', marketplaceApiRoutes);
app.use('/api/groups', require('./routes/groups.routes'));
app.use('/api/orders', require('./routes/orders.routes'));

// Page Routes
const pageRoutes = require('./routes/pages.routes');
app.use('/', pageRoutes);
