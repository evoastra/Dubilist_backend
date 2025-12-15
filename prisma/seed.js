// ===========================================
// DATABASE SEED - DUBILIST MARKETPLACE
// ===========================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('');
  console.log('🌱 Starting database seed...');
  console.log('');

  // ==========================================
  // 1. CREATE ROLES
  // ==========================================
  const roles = [
    { name: 'admin', description: 'Full system access' },
    { name: 'moderator', description: 'Content moderation access' },
    { name: 'seller', description: 'Can create and manage listings' },
    { name: 'buyer', description: 'Can browse and purchase' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles created');

  // ==========================================
  // 2. CREATE PERMISSIONS
  // ==========================================
  const permissions = [
    { key: 'listing.create', description: 'Create listings' },
    { key: 'listing.edit', description: 'Edit listings' },
    { key: 'listing.delete', description: 'Delete listings' },
    { key: 'listing.approve', description: 'Approve listings' },
    { key: 'listing.reject', description: 'Reject listings' },
    { key: 'user.view', description: 'View users' },
    { key: 'user.edit', description: 'Edit users' },
    { key: 'user.block', description: 'Block users' },
    { key: 'user.delete', description: 'Delete users' },
    { key: 'report.view', description: 'View reports' },
    { key: 'report.action', description: 'Take action on reports' },
    { key: 'analytics.view', description: 'View analytics' },
    { key: 'settings.edit', description: 'Edit system settings' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }
  console.log('✅ Permissions created');

  // ==========================================
  // 3. CREATE CATEGORIES
  // ==========================================
  const categories = [
    { 
      name: 'Electronics', 
      slug: 'electronics', 
      orderIndex: 1,
      description: 'Phones, Laptops, Gadgets'
    },
    { 
      name: 'Vehicles', 
      slug: 'vehicles', 
      orderIndex: 2,
      description: 'Cars, Bikes, Boats'
    },
    { 
      name: 'Property', 
      slug: 'property', 
      orderIndex: 3,
      description: 'Apartments, Villas, Land'
    },
    { 
      name: 'Furniture', 
      slug: 'furniture', 
      orderIndex: 4,
      description: 'Home & Office Furniture'
    },
    { 
      name: 'Fashion', 
      slug: 'fashion', 
      orderIndex: 5,
      description: 'Clothing, Shoes, Accessories'
    },
    { 
      name: 'Jobs', 
      slug: 'jobs', 
      orderIndex: 6,
      description: 'Job listings and opportunities'
    },
    { 
      name: 'Services', 
      slug: 'services', 
      orderIndex: 7,
      description: 'Professional services'
    },
    { 
      name: 'Community', 
      slug: 'community', 
      orderIndex: 8,
      description: 'Community items and events'
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { description: cat.description },
      create: cat,
    });
  }
  console.log('✅ Categories created (8 categories)');

  // ==========================================
  // 4. CREATE ADMIN USER
  // ==========================================
  const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
  const adminPasswordHash = await bcrypt.hash('Admin@123456', 12);

  await prisma.user.upsert({
    where: { email: 'admin@marketplace.com' },
    update: {},
    create: {
      email: 'admin@marketplace.com',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      isVerified: true,
    },
  });
  console.log('✅ Admin user created');

  // ==========================================
  // 5. CREATE TEST USER
  // ==========================================
  const buyerRole = await prisma.role.findFirst({ where: { name: 'buyer' } });
  const testPasswordHash = await bcrypt.hash('Test@123456', 12);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      phone: '+971501234567',
      passwordHash: testPasswordHash,
      roleId: buyerRole.id,
      isVerified: true,
    },
  });
  console.log('✅ Test user created');

  // ==========================================
  // 6. CREATE SAMPLE LISTINGS
  // ==========================================
  const electronicsCategory = await prisma.category.findFirst({ where: { slug: 'electronics' } });
  const vehiclesCategory = await prisma.category.findFirst({ where: { slug: 'vehicles' } });
  const propertyCategory = await prisma.category.findFirst({ where: { slug: 'property' } });

  const sampleListings = [
    {
      title: 'iPhone 14 Pro Max 256GB',
      description: 'Brand new iPhone 14 Pro Max, 256GB storage, Deep Purple color. Never used, still in sealed box with full Apple warranty.',
      price: 3500,
      categoryId: electronicsCategory.id,
      userId: testUser.id,
      city: 'Dubai',
      country: 'UAE',
      contactPhone: '+971501234567',
      status: 'approved',
      condition: 'new',
      isNegotiable: true,
      publishedAt: new Date(),
    },
    {
      title: 'MacBook Pro 14" M3 Pro',
      description: 'Apple MacBook Pro 14-inch with M3 Pro chip, 18GB RAM, 512GB SSD. Space Black color, excellent condition.',
      price: 7500,
      categoryId: electronicsCategory.id,
      userId: testUser.id,
      city: 'Abu Dhabi',
      country: 'UAE',
      contactPhone: '+971501234567',
      status: 'approved',
      condition: 'used',
      isNegotiable: true,
      publishedAt: new Date(),
    },
    {
      title: '2023 Toyota Land Cruiser',
      description: 'Toyota Land Cruiser 2023 model, GXR V6, white color. Only 15,000 km, full service history with Al Futtaim.',
      price: 320000,
      categoryId: vehiclesCategory.id,
      userId: testUser.id,
      city: 'Dubai',
      country: 'UAE',
      contactPhone: '+971501234567',
      status: 'approved',
      condition: 'used',
      isNegotiable: true,
      publishedAt: new Date(),
    },
    {
      title: '2 Bedroom Apartment - Downtown Dubai',
      description: 'Stunning 2BR apartment in Downtown Dubai with full Burj Khalifa view. 1,200 sqft, fully furnished, high floor.',
      price: 2500000,
      categoryId: propertyCategory.id,
      userId: testUser.id,
      city: 'Dubai',
      country: 'UAE',
      contactPhone: '+971501234567',
      status: 'approved',
      condition: null,
      isNegotiable: true,
      publishedAt: new Date(),
    },
    {
      title: 'Samsung Galaxy S24 Ultra',
      description: 'Samsung Galaxy S24 Ultra, 512GB, Titanium Black. Includes original box and accessories. 3 months old.',
      price: 4200,
      categoryId: electronicsCategory.id,
      userId: testUser.id,
      city: 'Sharjah',
      country: 'UAE',
      contactPhone: '+971501234567',
      status: 'pending',
      condition: 'used',
      isNegotiable: false,
    },
  ];

  for (const listing of sampleListings) {
    await prisma.listing.create({ data: listing });
  }
  console.log('✅ Sample listings created (5 listings)');

  // ==========================================
  // 7. CREATE SYSTEM CONFIG
  // ==========================================
  const configs = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'site_name', value: 'Dubilist' },
    { key: 'support_email', value: 'support@dubilist.ae' },
    { key: 'listing_expiry_days', value: '30' },
    { key: 'max_images_per_listing', value: '10' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config,
    });
  }
  console.log('✅ System config created');

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('');
  console.log('==========================================');
  console.log('🎉 DATABASE SEED COMPLETED!');
  console.log('==========================================');
  console.log('');
  console.log('📋 Test Credentials:');
  console.log('');
  console.log('   ADMIN:');
  console.log('   Email:    admin@marketplace.com');
  console.log('   Password: Admin@123456');
  console.log('');
  console.log('   USER:');
  console.log('   Email:    test@example.com');
  console.log('   Password: Test@123456');
  console.log('');
  console.log('==========================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });