/**
 * Marketplace API Routes
 * Handles API requests for marketplace functionality
 */
const express = require('express');
const router = express.Router();
const marketplaceController = require('../../controllers/marketplace.controller');
const { requireAuthForApi } = require('../../middleware/authJwt');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'public/uploads/marketplace');
  },
  filename: function(req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Create upload middleware
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error('Only image files are allowed!'));
  }
});

// Create a new listing (protected)
router.post('/', requireAuthForApi, upload.array('images', 5), marketplaceController.createListing);

// Get all listings with optional filtering (public)
router.get('/', marketplaceController.getListings);

// Search listings by keyword
router.get('/search', marketplaceController.searchListings);

// Look up product information by UPC code
router.get('/upc/:upc', marketplaceController.lookupUpc);

// Test endpoint for UPC lookup
router.get('/upc-test/:upc', (req, res) => {
  const { upc } = req.params;
  console.log('UPC test endpoint called with UPC:', upc);
  res.status(200).json({
    success: true,
    message: 'UPC test endpoint working',
    upc: upc
  });
});

// Search food items for autocomplete
router.get('/food-search', marketplaceController.searchFoodItems);

// Get a single listing by ID
router.get('/:id', marketplaceController.getListingById);

// Update a listing (protected)
router.put('/:id', requireAuthForApi, marketplaceController.updateListing);

// Delete a listing (protected)
router.delete('/:id', requireAuthForApi, marketplaceController.deleteListing);

module.exports = router;
