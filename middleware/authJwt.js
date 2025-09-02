const jwt = require('jsonwebtoken');
const db = require('../models');
const User = db.user;

const JWT_SECRET = process.env.JWT_SECRET || 'freshShare-auth-secret';

/**
 * Extracts and decodes JWT from request cookies or headers.
 * This function does not handle errors, it simply returns null if verification fails.
 * @param {Object} req - Express request object.
 * @returns {Object|null} - Decoded token payload or null if not found/invalid.
 */
const decodeToken = (req) => {
  let token = null;

  // Prefer token from cookie
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // Fallback to Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    return null;
  }

  try {
    // Verify the token and return the decoded payload
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    // Log the error but don't throw, just return null for an invalid token
    console.error('JWT verification failed:', error.message);
    return null;
  }
};

/**
 * Renews the JWT if it's nearing expiration (e.g., within the next 24 hours).
 * This helps keep the user logged in without interruption.
 * @param {Object} res - Express response object.
 * @param {Object} decoded - The decoded JWT payload which includes 'exp' and 'id'.
 */
const renewTokenIfNecessary = (res, decoded) => {
  const nowInSeconds = Date.now() / 1000;
  const oneDayInSeconds = 24 * 60 * 60; // 24 hours

  // Check if the token has an expiration and if it's less than a day away
  if (decoded.exp && (decoded.exp - nowInSeconds < oneDayInSeconds)) {
    console.log(`Token for user ${decoded.id} is nearing expiration. Renewing...`);

    const newToken = jwt.sign({ id: decoded.id }, JWT_SECRET, {
      expiresIn: '7d' // Renew for another 7 days
    });

    // Set the new token in the cookie
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
      path: '/'
    });
    console.log('Token renewed successfully.');
  }
};

/**
 * Global middleware to universally handle user authentication state.
 * It decodes the token, fetches the user, and attaches them to `req.user` and `res.locals.user`.
 * This middleware is NON-PROTECTIVE; it simply makes user info available if they are logged in.
 */
const addUserToRequestAndLocals = async (req, res, next) => {
  const decoded = decodeToken(req);

  if (decoded && decoded.id) {
    try {
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        // Attach user to the request object for use in protected routes
        req.user = user;
        // Attach user to response locals for use in EJS templates
        res.locals.user = user;
        
        // Check if the token needs renewal
        renewTokenIfNecessary(res, decoded);
      }
    } catch (error) {
      console.error('Error fetching user during authentication:', error);
    }
  }

  // Always continue to the next middleware
  next();
};

/**
 * Protective middleware for WEB PAGES.
 * It checks if a user is authenticated and redirects to the login page if not.
 * This middleware MUST run *after* `addUserToRequestAndLocals`.
 */
const requireAuthForPage = (req, res, next) => {
  if (req.user) {
    // If user is attached to the request, they are authenticated.
    return next();
  }

  // If no user, redirect to login, preserving the intended destination.
  res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}&error=Please+log+in+to+view+this+page`);
};

/**
 * Protective middleware for API ENDPOINTS.
 * It checks for a valid token and an existing user, returning a JSON error if authentication fails.
 */
const requireAuthForApi = async (req, res, next) => {
  const decoded = decodeToken(req);

  if (!decoded || !decoded.id) {
    return res.status(403).json({ success: false, message: 'Authentication failed. No token provided.' });
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User not found.' });
    }

    // Attach user and userId to the request for use in controllers
    req.user = user;
    req.userId = user._id;

    // Check if the token needs renewal
    renewTokenIfNecessary(res, decoded);

    next();
  } catch (error) {
    console.error('API authentication error:', error);
    return res.status(500).json({ success: false, message: 'Server error during API authentication.' });
  }
};

const authJwt = {
  addUserToRequestAndLocals,
  requireAuthForPage,
  requireAuthForApi,
};

module.exports = authJwt;
