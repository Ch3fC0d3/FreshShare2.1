const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cors = require('cors');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { addUserToRequestAndLocals, requireAuthForPage } = require('./middleware/authJwt');

// Load environment variables from .env file
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '.env');
console.log('Loading environment variables from:', envPath);
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  } else {
    console.log('Successfully loaded environment variables');
  }
} else {
  console.error('.env file not found at path:', envPath);
  dotenv.config(); // Fallback to default dotenv behavior
}

const app = express();
const PORT = process.env.PORT || 3001;

// Database configuration
const dbConfig = require('./config/db.config.js');

// Connect to MongoDB with retry logic
console.log('Connecting to MongoDB...');
    
const connectWithRetry = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Successfully connected to MongoDB!');
    console.log('Connection details:', {
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    });
    
    // Initialize database and start server
    initializeDatabase();
    startServer();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    console.error('Connection details:', {
      code: err.code,
      name: err.name,
      message: err.message
    });
    
    // Retry connection after 5 seconds
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

connectWithRetry();

// Start server function
function startServer() {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

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
const wrapAsync = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

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
app.get('/', (req, res) => {
  res.render('pages/index', { 
    title: 'FreshShare - Home'
  });
});

app.get('/marketplace', async (req, res) => {
  try {
    // Fetch listings from the database
    const db = require('./models');
    const Listing = db.listing;
    
    // Get query parameters for filtering
    const { 
      category, 
      minPrice, 
      maxPrice, 
      isOrganic, 
      sortBy = 'latest',
      search
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (category) filter.category = category;
    if (isOrganic) filter.isOrganic = isOrganic === 'true';
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    
    // Add text search if search parameter is provided
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Build sort object
    let sort = { createdAt: -1 }; // Default sort by newest
    
    if (sortBy === 'price-asc') sort = { price: 1 };
    if (sortBy === 'price-desc') sort = { price: -1 };
    
    // Execute query
    const listings = await Listing.find(filter)
      .sort(sort)
      .limit(12) // Limit to 12 listings for the page
      .populate('seller', 'username profileImage');
    
    // Render the marketplace page with the listings
    res.render('pages/marketplace', { 
      title: 'FreshShare - Marketplace',
      listings: listings || [],
      filters: {
        category,
        minPrice,
        maxPrice,
        isOrganic,
        sortBy,
        search
      }
    });
  } catch (error) {
    console.error('Error fetching marketplace listings:', error);
    // Render the page with an empty listings array if there's an error
    res.render('pages/marketplace', { 
      title: 'FreshShare - Marketplace',
      listings: [],
      filters: {},
      error: 'Failed to load marketplace listings'
    });
  }
});

app.get('/create-listing', requireAuthForPage, (req, res) => {
  res.render('pages/create-listing', { 
    title: 'FreshShare - Create Listing'
  });
});

app.get('/forum', (req, res) => {
  res.render('pages/forum', { 
    title: 'FreshShare - Forum'
  });
});

app.get('/groups', (req, res) => {
  res.render('pages/groups', { 
    title: 'FreshShare - Groups'
  });
});

app.get('/create-group', requireAuthForPage, (req, res) => {
  res.render('pages/create-group', { 
    title: 'FreshShare - Create New Group'
  });
});

app.get('/group-details', (req, res) => {
  res.render('pages/group-details', { 
    title: 'FreshShare - Group Details',
    groupId: req.query.id
  });
});

app.get('/groups/:id/shopping', (req, res) => {
  res.render('pages/group_shopping', { 
    title: 'FreshShare - Group Shopping',
    groupId: req.params.id
  });
});

app.get('/groups/:id/orders', (req, res) => {
  res.render('pages/group_orders', { 
    title: 'FreshShare - Group Orders',
    groupId: req.params.id
  });
});

app.get('/orders/:id', (req, res) => {
  res.render('pages/order_details', { 
    title: 'FreshShare - Order Details',
    orderId: req.params.id
  });
});

app.get('/about', (req, res) => {
  res.render('pages/about', { 
    title: 'FreshShare - About'
  });
});

app.get('/contact', (req, res) => {
  res.render('pages/contact', { 
    title: 'FreshShare - Contact'
  });
});

// Protected page routes that require authentication
app.get('/profile', requireAuthForPage, (req, res) => {
  res.render('pages/profile', {
    title: 'FreshShare - Profile',
    user: req.user // user is attached by `addUserToRequestAndLocals`
  });
});

app.get('/profile-edit', requireAuthForPage, (req, res) => {
  res.render('pages/profile-edit', {
    title: 'FreshShare - Edit Profile',
    user: req.user
  });
});

app.get('/dashboard', requireAuthForPage, (req, res) => {
  res.render('pages/dashboard', {
    title: 'FreshShare - Dashboard'
  });
});
