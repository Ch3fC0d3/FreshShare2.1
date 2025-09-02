const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuthForApi } = require('../middleware/authJwt');

/**
 * Authentication Routes
 */

// Page routes for authentication
router.get('/login', (req, res) => {
    // If user is already logged in, redirect to the dashboard
    if (req.user) {
        return res.redirect('/dashboard');
    }
    res.render('pages/login', { 
        title: 'FreshShare - Login'
    });
});

router.get('/signup', (req, res) => {
    // If user is already logged in, redirect to the dashboard
    if (req.user) {
        return res.redirect('/dashboard');
    }
    res.render('pages/signup', { 
        title: 'FreshShare - Sign Up'
    });
});

router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

// API routes
// Register a new user
router.post('/api/auth/signup', authController.signup);

// Login a user
router.post('/api/auth/login', authController.login);

// Get user profile (protected route)
router.get('/api/auth/profile', requireAuthForApi, authController.getUserProfile);

// Update user profile (protected route)
router.put('/api/auth/profile', requireAuthForApi, authController.updateUserProfile);

module.exports = router;
