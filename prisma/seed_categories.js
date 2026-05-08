// ===========================================
// DATABASE SEED - DUBILIST MARKETPLACE (EXTENDED CATEGORIES)
// ===========================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with rich categories...');

  // 1. CLEAR EXISTING CATEGORIES (Optional but good for a fresh start in dev)
  // await prisma.category.deleteMany({}); 

  // 2. DEFINE MAIN CATEGORIES
  const mainCategories = [
    { name: 'Motors', slug: 'motors', description: 'Cars, Bikes, Heavy Vehicles', orderIndex: 1 },
    { name: 'Jobs', slug: 'jobs', description: 'Job opportunities', orderIndex: 2 },
    { name: 'Property', slug: 'property', description: 'Real Estate for Sale & Rent', orderIndex: 3 },
    { name: 'Classifieds', slug: 'classifieds', description: 'Electronics, Items, Books', orderIndex: 4 },
    { name: 'Mobiles & Tablets', slug: 'mobiles-tablets', description: 'Phones and Accessories', orderIndex: 5 },
    { name: 'Furniture & Garden', slug: 'furniture-garden', description: 'Home & Office furniture', orderIndex: 6 },
    { name: 'Community', slug: 'community', description: 'Services and local groups', orderIndex: 7 }
  ];

  const categoryMap = {};

  for (const cat of mainCategories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { description: cat.description, orderIndex: cat.orderIndex },
      create: cat,
    });
    categoryMap[cat.name] = created.id;
  }
  console.log('✅ Main categories created');

  // 3. DEFINE SUBCATEGORIES
  const subCategories = [
    // MOTORS
    { name: 'Used Cars', parent: 'Motors' },
    { name: 'New Cars', parent: 'Motors' },
    { name: 'Export Cars', parent: 'Motors' },
    { name: 'Rental Cars', parent: 'Motors' },
    { name: 'Motorcycles', parent: 'Motors' },
    { name: 'Auto Accessories & Parts', parent: 'Motors' },
    { name: 'Heavy Vehicles', parent: 'Motors' },
    { name: 'Boats', parent: 'Motors' },
    { name: 'Number Plates', parent: 'Motors' },

    // JOBS
    { name: 'IT & Telecoms', parent: 'Jobs' },
    { name: 'Healthcare', parent: 'Jobs' },
    { name: 'Sales & Marketing', parent: 'Jobs' },
    { name: 'Hospitality & Tourism', parent: 'Jobs' },
    { name: 'Finance & Banking', parent: 'Jobs' },
    { name: 'Engineering', parent: 'Jobs' },
    { name: 'Education', parent: 'Jobs' },
    { name: 'Construction', parent: 'Jobs' },

    // PROPERTY
    { name: 'Apartment (For Sale)', parent: 'Property' },
    { name: 'Villa (For Sale)', parent: 'Property' },
    { name: 'Townhouse (For Sale)', parent: 'Property' },
    { name: 'New Projects', parent: 'Property' },
    { name: 'Off-Plan', parent: 'Property' },
    { name: 'Land', parent: 'Property' },
    { name: 'Apartment (For Rent)', parent: 'Property' },
    { name: 'Villa (For Rent)', parent: 'Property' },
    { name: 'Office (For Rent)', parent: 'Property' },
    { name: 'Monthly Short Term', parent: 'Property' },

    // CLASSIFIEDS (Electronics)
    { name: 'Home Audio & Turntables', parent: 'Classifieds' },
    { name: 'DVD & Home Theater', parent: 'Classifieds' },
    { name: 'Gadgets', parent: 'Classifieds' },
    { name: 'Smart Home', parent: 'Classifieds' },
    { name: 'Televisions', parent: 'Classifieds' },
    { name: 'Electronic Accessories', parent: 'Classifieds' },
    { name: 'Car Electronics', parent: 'Classifieds' },
    { name: 'Wearable Technology', parent: 'Classifieds' },

    // MOBILES
    { name: 'Mobile Phones', parent: 'Mobiles & Tablets' },
    { name: 'Tablets', parent: 'Mobiles & Tablets' },
    { name: 'Accessories', parent: 'Mobiles & Tablets' },

    // FURNITURE
    { name: 'Home Accessories', parent: 'Furniture & Garden' },
    { name: 'Garden & Outdoor', parent: 'Furniture & Garden' },
    { name: 'Lighting & Fans', parent: 'Furniture & Garden' },
    { name: 'Rugs & Carpets', parent: 'Furniture & Garden' },
    { name: 'Curtains & Blinds', parent: 'Furniture & Garden' },
    { name: 'Tools & Home Improvement', parent: 'Furniture & Garden' },

    // COMMUNITY
    { name: 'Auto Services', parent: 'Community' },
    { name: 'Consultancy Services', parent: 'Community' },
    { name: 'Domestic', parent: 'Community' },
    { name: 'Event & Entertainment', parent: 'Community' },
    { name: 'Freelancers', parent: 'Community' },
    { name: 'Health & Wellbeing Services', parent: 'Community' },
    { name: 'Home Maintenance', parent: 'Community' },
    { name: 'Movers & Removals', parent: 'Community' },
    { name: 'Restoration & Repairs', parent: 'Community' },
    { name: 'Tutors & Classes', parent: 'Community' }
  ];

  for (const sub of subCategories) {
    const parentId = categoryMap[sub.parent];
    const slug = `${sub.parent.toLowerCase().replace(/ /g, '-')}-${sub.name.toLowerCase().replace(/ /g, '-')}`;
    
    await prisma.category.upsert({
      where: { slug: slug },
      update: { parentId: parentId },
      create: {
        name: sub.name,
        slug: slug,
        parentId: parentId,
        orderIndex: 0
      }
    });
  }
  console.log('✅ All subcategories created');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
