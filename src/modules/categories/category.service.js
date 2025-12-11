// ===========================================
// CATEGORY SERVICE
// ===========================================

const { prisma } = require('../../config/database');
const { ApiError } = require('../../middleware/errorHandler');

class CategoryService {
  // Get all categories
  async getCategories() {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            listings: { where: { status: 'approved', isDeleted: false } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Build tree structure
    const rootCategories = categories.filter(c => !c.parentId);
    return rootCategories.map(cat => ({
      ...cat,
      listingsCount: cat._count.listings,
    }));
  }

  // Get category by ID or slug
  async getCategory(identifier) {
    const where = isNaN(identifier)
      ? { slug: identifier }
      : { id: parseInt(identifier, 10) };

    const category = await prisma.category.findFirst({
      where: { ...where, isActive: true },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            listings: { where: { status: 'approved', isDeleted: false } },
          },
        },
      },
    });

    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    return {
      ...category,
      listingsCount: category._count.listings,
    };
  }

  // Create category (admin)
  async createCategory(data) {
    const { name, slug, description, iconUrl, parentId, sortOrder = 0 } = data;

    // Check slug uniqueness
    const existing = await prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ApiError(409, 'SLUG_EXISTS', 'Category with this slug already exists');
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        iconUrl,
        parentId,
        sortOrder,
      },
    });

    return category;
  }

  // Update category (admin)
  async updateCategory(id, data) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== category.slug) {
      const existing = await prisma.category.findUnique({
        where: { slug: data.slug },
      });

      if (existing) {
        throw new ApiError(409, 'SLUG_EXISTS', 'Category with this slug already exists');
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    return updated;
  }

  // Delete category (admin)
  async deleteCategory(id) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { listings: true, children: true } },
      },
    });

    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }

    if (category._count.listings > 0) {
      throw new ApiError(400, 'CATEGORY_HAS_LISTINGS', 'Cannot delete category with listings');
    }

    if (category._count.children > 0) {
      throw new ApiError(400, 'CATEGORY_HAS_CHILDREN', 'Cannot delete category with subcategories');
    }

    await prisma.category.delete({
      where: { id },
    });

    return { message: 'Category deleted' };
  }
}

module.exports = { categoryService: new CategoryService() };