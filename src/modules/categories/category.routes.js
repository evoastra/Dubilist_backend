const express = require('express');
const router = express.Router();
const { categoryService } = require('./category.service');
const { authenticateToken } = require('../../middleware/authMiddleware');
const { requireAdmin } = require('../../middleware/roleMiddleware');

// GET all categories
router.get('/', async (req, res) => {
	try {
		const categories = await categoryService.getCategories();
		res.json({ success: true, data: categories });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// GET category by id or slug
router.get('/:identifier', async (req, res) => {
	try {
		const category = await categoryService.getCategory(req.params.identifier);
		res.json({ success: true, data: category });
	} catch (error) {
		res.status(404).json({ success: false, error: error.message });
	}
});

// CREATE category (admin only, supports thumbnails)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { name, slug, description, iconUrl, imageUrl, thumbnails, parentId, orderIndex } = req.body;
		const category = await categoryService.createCategory({
			name, slug, description, iconUrl, imageUrl, thumbnails, parentId, orderIndex
		});
		res.status(201).json({ success: true, data: category });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
});

// UPDATE category (admin only, supports thumbnails)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
	try {
		const updated = await categoryService.updateCategory(parseInt(req.params.id, 10), req.body);
		res.json({ success: true, data: updated });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
});

// DELETE category (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
	try {
		const result = await categoryService.deleteCategory(parseInt(req.params.id, 10));
		res.json({ success: true, data: result });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
});

module.exports = router;
