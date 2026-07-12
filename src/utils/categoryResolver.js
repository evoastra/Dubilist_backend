// Maps homepage / legacy frontend category IDs to canonical category slugs.
const LEGACY_FRONTEND_CATEGORY_SLUGS = {
  1: 'motors',
  2: 'jobs',
  3: 'property',
  4: 'classifieds',
  5: 'mobiles-tablets',
  6: 'furniture-garden',
};

const CONDITION_REQUIRED_SLUGS = new Set(['motors', 'mobiles-tablets', 'furniture-garden']);

async function resolveCategoryFilter(prisma, categoryId) {
  if (!categoryId) {
    return { ids: null, rootSlug: null };
  }

  const legacySlug = LEGACY_FRONTEND_CATEGORY_SLUGS[categoryId];
  let rootCategory = null;

  if (legacySlug) {
    rootCategory = await prisma.category.findFirst({
      where: { slug: legacySlug, isActive: true, parentId: null },
    });
  } else {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return { ids: [categoryId], rootSlug: null };
    }
    rootCategory = category.parentId
      ? await prisma.category.findUnique({ where: { id: category.parentId } })
      : category;
  }

  if (!rootCategory) {
    return { ids: [categoryId], rootSlug: legacySlug || null };
  }

  const children = await prisma.category.findMany({
    where: { parentId: rootCategory.id, isActive: true },
    select: { id: true },
  });

  return {
    ids: [rootCategory.id, ...children.map((child) => child.id)],
    rootSlug: rootCategory.slug,
  };
}

async function getRootCategorySlug(db, category) {
  if (!category?.parentId) {
    return category?.slug || null;
  }

  const parent = await db.category.findUnique({ where: { id: category.parentId } });
  return parent?.slug || category.slug;
}

module.exports = {
  LEGACY_FRONTEND_CATEGORY_SLUGS,
  CONDITION_REQUIRED_SLUGS,
  resolveCategoryFilter,
  getRootCategorySlug,
};
