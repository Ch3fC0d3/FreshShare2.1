const express = require('express');
const router = express.Router();
const { requireAuthForPage } = require('../middleware/authJwt');
const marketplaceController = require('../controllers/marketplace.controller');
const asyncHandler = require('../utils/asyncHandler');

// Page Routes
router.get('/', (req, res) => {
  res.render('pages/index', {
    title: 'FreshShare - Home'
  });
});

router.get('/marketplace', asyncHandler(marketplaceController.getMarketplacePage));

router.get('/create-listing', requireAuthForPage, (req, res) => {
  res.render('pages/create-listing', {
    title: 'FreshShare - Create Listing'
  });
});

router.get('/forum', (req, res) => {
  res.render('pages/forum', {
    title: 'FreshShare - Forum'
  });
});

router.get('/groups', (req, res) => {
  res.render('pages/groups', {
    title: 'FreshShare - Groups'
  });
});

router.get('/create-group', requireAuthForPage, (req, res) => {
  res.render('pages/create-group', {
    title: 'FreshShare - Create New Group'
  });
});

router.get('/group-details', (req, res) => {
  res.render('pages/group-details', {
    title: 'FreshShare - Group Details',
    groupId: req.query.id
  });
});

router.get('/groups/:id/shopping', (req, res) => {
  res.render('pages/group_shopping', {
    title: 'FreshShare - Group Shopping',
    groupId: req.params.id
  });
});

router.get('/groups/:id/orders', (req, res) => {
  res.render('pages/group_orders', {
    title: 'FreshShare - Group Orders',
    groupId: req.params.id
  });
});

router.get('/orders/:id', (req, res) => {
  res.render('pages/order_details', {
    title: 'FreshShare - Order Details',
    orderId: req.params.id
  });
});

router.get('/about', (req, res) => {
  res.render('pages/about', {
    title: 'FreshShare - About'
  });
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', {
    title: 'FreshShare - Contact'
  });
});

// Protected page routes that require authentication
router.get('/profile', requireAuthForPage, (req, res) => {
  res.render('pages/profile', {
    title: 'FreshShare - Profile',
    user: req.user // user is attached by `addUserToRequestAndLocals`
  });
});

router.get('/profile-edit', requireAuthForPage, (req, res) => {
  res.render('pages/profile-edit', {
    title: 'FreshShare - Edit Profile',
    user: req.user
  });
});

router.get('/dashboard', requireAuthForPage, (req, res) => {
  res.render('pages/dashboard', {
    title: 'FreshShare - Dashboard'
  });
});

module.exports = router;
