const express = require('express');
const router = express.Router();
const { requireAuthForApi } = require('../middleware/authJwt');
const groupController = require('../controllers/group.controller');

// ===== GROUP MANAGEMENT =====

// Create a new group (protected)
router.post('/', requireAuthForApi, groupController.createGroup);

// Get all groups (public)
router.get('/', groupController.getAllGroups);

// Get a specific group (public)
router.get('/:id', groupController.getGroupById);

// Update a group (protected)
router.put('/:id', requireAuthForApi, groupController.updateGroup);

// Delete a group (protected)
router.delete('/:id', requireAuthForApi, groupController.deleteGroup);

// ===== MEMBERSHIP MANAGEMENT =====

// Join a group (protected)
router.post('/:id/join', requireAuthForApi, groupController.joinGroup);

// Leave a group (protected)
router.post('/:id/leave', requireAuthForApi, groupController.leaveGroup);

// Get group members (protected)
router.get('/:id/members', requireAuthForApi, groupController.getGroupMembers);

// Invite a user to the group (protected)
router.post('/:id/invite', requireAuthForApi, groupController.inviteToGroup);

// ===== SHOPPING LIST MANAGEMENT (all protected) =====

router.get('/:id/shopping-list', requireAuthForApi, groupController.getShoppingList);
router.post('/:id/shopping-list', requireAuthForApi, groupController.addShoppingListItem);
router.put('/:id/shopping-list/:itemId', requireAuthForApi, groupController.updateShoppingListItem);
router.delete('/:id/shopping-list/:itemId', requireAuthForApi, groupController.deleteShoppingListItem);

// ===== DISCUSSION BOARD (all protected) =====

router.get('/:id/messages', requireAuthForApi, groupController.getMessages);
router.post('/:id/messages', requireAuthForApi, groupController.addMessage);
router.delete('/:id/messages/:messageId', requireAuthForApi, groupController.deleteMessage);

// ===== EVENT MANAGEMENT (all protected) =====

router.get('/:id/events', requireAuthForApi, groupController.getEvents);
router.post('/:id/events', requireAuthForApi, groupController.createEvent);
router.put('/:id/events/:eventId', requireAuthForApi, groupController.updateEvent);
router.delete('/:id/events/:eventId', requireAuthForApi, groupController.deleteEvent);

// ===== LEGACY ROUTES (all protected) =====

// Propose a new product
router.post('/:id/propose-product', requireAuthForApi, async (req, res) => {
    try {
        const groupId = req.params.id;
        const product = req.body;
        
        // Find the group
        const group = await require('../models/group.model').findById(groupId);
        
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                message: 'Group not found' 
            });
        }
        
        // Check if user is a member
        const isMember = group.members.includes(req.userId);
        
        if (!isMember) {
            return res.status(403).json({ 
                success: false, 
                message: 'You must be a member to propose products' 
            });
        }
        
        // Add product to proposed products
        if (!group.proposedProducts) {
            group.proposedProducts = [];
        }
        
        group.proposedProducts.push({
            ...product,
            proposedBy: req.userId,
            votes: 0,
            dateProposed: new Date()
        });
        
        await group.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Product proposed successfully',
            product
        });
    } catch (error) {
        console.error('Error proposing product:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to propose product'
        });
    }
});

// Vote on a proposed product
router.post('/:groupId/vote/:productId', requireAuthForApi, async (req, res) => {
    try {
        const { groupId, productId } = req.params;
        
        // Find the group
        const group = await require('../models/group.model').findById(groupId);
        
        if (!group) {
            return res.status(404).json({ 
                success: false, 
                message: 'Group not found' 
            });
        }
        
        // Check if user is a member
        const isMember = group.members.includes(req.userId);
        
        if (!isMember) {
            return res.status(403).json({ 
                success: false, 
                message: 'You must be a member to vote on products' 
            });
        }
        
        // Find the product
        if (!group.proposedProducts) {
            return res.status(404).json({ 
                success: false, 
                message: 'No proposed products found' 
            });
        }
        
        const productIndex = group.proposedProducts.findIndex(
            product => product._id.toString() === productId
        );
        
        if (productIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }
        
        // Increment vote count
        group.proposedProducts[productIndex].votes += 1;
        await group.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Vote recorded successfully',
            votes: group.proposedProducts[productIndex].votes
        });
    } catch (error) {
        console.error('Error voting on product:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to record vote'
        });
    }
});

// Legacy discussion board route (for backward compatibility)
router.post('/:id/discussion', requireAuthForApi, async (req, res) => {
    try {
        // Forward to the new message endpoint
        return groupController.addMessage(req, res);
    } catch (error) {
        console.error('Error posting message:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to post message'
        });
    }
});

module.exports = router;
