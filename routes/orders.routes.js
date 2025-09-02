const express = require('express');
const router = express.Router();
const { requireAuthForApi } = require('../middleware/authJwt');
const orderController = require('../controllers/order.controller');

// Apply authentication middleware to all routes in this file
router.use(requireAuthForApi);

// Create a new order
router.post('/', orderController.createOrder);

// Get all orders for a group
router.get('/group/:groupId', orderController.getGroupOrders);

// Get a specific order by ID
router.get('/:orderId', orderController.getOrderById);

// Update an order
router.put('/:orderId', orderController.updateOrder);

// Join an order as a participant
router.post('/:orderId/join', orderController.joinOrder);

// Update payment status
router.put('/:orderId/payment', orderController.updatePaymentStatus);

// Cancel an order
router.put('/:orderId/cancel', orderController.cancelOrder);

module.exports = router;
