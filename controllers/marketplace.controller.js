const db = require('../models');
const Listing = db.listing;
const usdaApi = require('../utils/usdaApi');

/**
 * Create a new marketplace listing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createListing = async (req, res) => {
  try {
    // Create a new listing object
    const listing = new Listing({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      priceUnit: req.body.priceUnit,
      category: req.body.category,
      condition: req.body.condition,
      location: req.body.location,
      seller: req.body.userId, // This will be replaced with actual user ID from auth middleware
      isOrganic: req.body.isOrganic,
      quantity: req.body.quantity,
      tags: req.body.tags,
      upcCode: req.body.upcCode
    });
    
    // If UPC code is provided, fetch nutritional information
    if (req.body.upcCode) {
      try {
        const productInfo = await usdaApi.getProductByUpc(req.body.upcCode);
        if (productInfo.success) {
          listing.nutritionalInfo = {
            fdcId: productInfo.data.fdcId,
            brandName: productInfo.data.brandName,
            ingredients: productInfo.data.ingredients,
            servingSize: productInfo.data.servingSize,
            servingSizeUnit: productInfo.data.servingSizeUnit,
            foodNutrients: productInfo.data.foodNutrients
          };
          
          // If no title was provided, use the product description
          if (!req.body.title || req.body.title.trim() === '') {
            listing.title = productInfo.data.description;
          }
        }
      } catch (upcError) {
        console.error('Error fetching UPC data:', upcError);
        // Continue with listing creation even if UPC lookup fails
      }
    }

    // If images were uploaded, add them to the listing
    if (req.files && req.files.length > 0) {
      listing.images = req.files.map(file => file.path);
    }

    // Save the listing to the database
    const savedListing = await listing.save();
    
    res.status(201).json({
      success: true,
      message: "Listing created successfully",
      data: savedListing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create listing",
      error: error.message
    });
  }
};

/**
 * Render the marketplace page with listings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getMarketplacePage = async (req, res) => {
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
};

/**
 * Get all marketplace listings with optional filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getListings = async (req, res) => {
  try {
    const { 
      category, 
      minPrice, 
      maxPrice, 
      isOrganic, 
      sortBy, 
      limit = 10, 
      page = 1,
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
    
    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    // Execute query
    const listings = await Listing.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .populate('seller', 'username profileImage');
    
    // Get total count for pagination
    const total = await Listing.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: {
        listings,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch listings",
      error: error.message
    });
  }
};

/**
 * Get a single listing by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getListingById = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('seller', 'username profileImage');
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found"
      });
    }
    
    res.status(200).json({
      success: true,
      data: listing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch listing",
      error: error.message
    });
  }
};

/**
 * Update a listing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found"
      });
    }
    
    // Check if the user is the owner of the listing
    // This will be replaced with actual user ID from auth middleware
    if (listing.seller.toString() !== req.body.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this listing"
      });
    }
    
    // Prepare update object
    const updateData = {
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      priceUnit: req.body.priceUnit,
      category: req.body.category,
      condition: req.body.condition,
      location: req.body.location,
      isOrganic: req.body.isOrganic,
      isAvailable: req.body.isAvailable,
      quantity: req.body.quantity,
      tags: req.body.tags,
      updatedAt: Date.now()
    };
    
    // If UPC code is updated, fetch new nutritional information
    if (req.body.upcCode && req.body.upcCode !== listing.upcCode) {
      updateData.upcCode = req.body.upcCode;
      
      try {
        const productInfo = await usdaApi.getProductByUpc(req.body.upcCode);
        if (productInfo.success) {
          updateData.nutritionalInfo = {
            fdcId: productInfo.data.fdcId,
            brandName: productInfo.data.brandName,
            ingredients: productInfo.data.ingredients,
            servingSize: productInfo.data.servingSize,
            servingSizeUnit: productInfo.data.servingSizeUnit,
            foodNutrients: productInfo.data.foodNutrients
          };
        }
      } catch (upcError) {
        console.error('Error fetching UPC data:', upcError);
        // Continue with listing update even if UPC lookup fails
      }
    }
    
    // Update the listing
    const updatedListing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      message: "Listing updated successfully",
      data: updatedListing
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update listing",
      error: error.message
    });
  }
};

/**
 * Delete a listing
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found"
      });
    }
    
    // Check if the user is the owner of the listing
    // This will be replaced with actual user ID from auth middleware
    if (listing.seller.toString() !== req.body.userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this listing"
      });
    }
    
    await Listing.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: "Listing deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete listing",
      error: error.message
    });
  }
};

/**
 * Search listings by keyword
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchListings = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }
    
    const listings = await Listing.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
    .sort({ score: { $meta: "textScore" } })
    .limit(10)
    .populate('seller', 'username profileImage');
    
    res.status(200).json({
      success: true,
      data: listings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search listings",
      error: error.message
    });
  }
};

/**
 * Look up product information by UPC code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.lookupUpc = async (req, res) => {
  try {
    const { upc } = req.params;
    console.log('Server: Received UPC lookup request for:', upc);
    
    if (!upc) {
      console.log('Server: UPC code is missing');
      return res.status(400).json({
        success: false,
        message: "UPC code is required"
      });
    }
    
    // Call USDA API to get product information
    console.log('Server: Calling USDA API for UPC:', upc);
    const productInfo = await usdaApi.getProductByUpc(upc);
    console.log('Server: USDA API response:', JSON.stringify(productInfo, null, 2));
    
    if (!productInfo.success) {
      console.log('Server: USDA API returned no results');
      return res.status(404).json({
        success: false,
        message: productInfo.message || "Product not found"
      });
    }
    
    console.log('Server: Sending successful response');
    res.status(200).json(productInfo);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to look up UPC code",
      error: error.message
    });
  }
};

/**
 * Search for food items for autocomplete
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.searchFoodItems = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    // Call USDA API to search for food items
    const result = await usdaApi.searchFoodItems(query);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error searching food items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search food items',
      error: error.message
    });
  }
};
