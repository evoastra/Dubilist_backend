// ===========================================
// DATABASE SEED
// ===========================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create roles
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
  console.log('Roles created');

  // Create permissions
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
  console.log('Permissions created');

  // Create categories
  const categories = [
    { name: 'Electronics', slug: 'electronics', sortOrder: 1 },
    { name: 'Vehicles', slug: 'vehicles', sortOrder: 2 },
    { name: 'Property', slug: 'property', sortOrder: 3 },
    { name: 'Furniture', slug: 'furniture', sortOrder: 4 },
    { name: 'Fashion', slug: 'fashion', sortOrder: 5 },
    { name: 'Jobs', slug: 'jobs', sortOrder: 6 },
    { name: 'Services', slug: 'services', sortOrder: 7 },
    { name: 'Community', slug: 'community', sortOrder: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('Categories created');

  // Create admin user
  const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  await prisma.user.upsert({
    where: { email: 'admin@marketplace.com' },
    update: {},
    create: {
      email: 'admin@marketplace.com',
      name: 'System Admin',
      passwordHash,
      roleId: adminRole.id,
      isVerified: true,
    },
  });
  console.log('Admin user created (admin@marketplace.com / Admin@123456)');

  // Create system config
  const configs = [
    { key: 'maintenance_mode', value: 'false' },
    { key: 'site_name', value: 'Marketplace' },
    { key: 'support_email', value: 'support@marketplace.com' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }
  console.log('System config created');

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });