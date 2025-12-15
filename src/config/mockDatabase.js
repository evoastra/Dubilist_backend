// // ===========================================
// // MOCK DATABASE - FOR TESTING WITHOUT DB
// // ===========================================

// const mockData = {
//   users: [
//     {
//       id: 1,
//       name: 'Admin User',
//       email: 'admin@marketplace.com',
//       phone: '+971501234567',
//       passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G8z9XJz5xZZ5Z6',
//       roleId: 1,
//       isVerified: true,
//       isBlocked: false,
//       canPostListings: true,
//       avatarUrl: null,
//       bio: 'System Administrator',
//       lastLoginAt: new Date(),
//       isDeleted: false,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       role: { id: 1, name: 'admin' }
//     },
//     {
//       id: 2,
//       name: 'Test User',
//       email: 'test@example.com',
//       phone: '+971509876543',
//       passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G8z9XJz5xZZ5Z6',
//       roleId: 4,
//       isVerified: true,
//       isBlocked: false,
//       canPostListings: true,
//       avatarUrl: null,
//       bio: null,
//       lastLoginAt: new Date(),
//       isDeleted: false,
//       createdAt: new Date(),
//       updatedAt: new Date(),
//       role: { id: 4, name: 'buyer' }
//     }
//   ],
//   roles: [
//     { id: 1, name: 'admin', description: 'Administrator' },
//     { id: 2, name: 'moderator', description: 'Moderator' },
//     { id: 3, name: 'seller', description: 'Seller' },
//     { id: 4, name: 'buyer', description: 'Buyer' }
//   ],
//   listings: [
//     {
//       id: 1,
//       userId: 2,
//       title: 'iPhone 14 Pro Max',
//       description: 'Brand new, sealed in box',
//       price: 4500,
//       currency: 'AED',
//       categoryId: 1,
//       city: 'Dubai',
//       country: 'UAE',
//       status: 'approved',
//       viewsCount: 150,
//       favoritesCount: 12,
//       isDeleted: false,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     }
//   ],
//   categories: [
//     { id: 1, name: 'Electronics', slug: 'electronics', parentId: null },
//     { id: 2, name: 'Vehicles', slug: 'vehicles', parentId: null },
//     { id: 3, name: 'Property', slug: 'property', parentId: null },
//     { id: 4, name: 'Furniture', slug: 'furniture', parentId: null }
//   ],
//   favorites: [],
//   chatRooms: [],
//   chatMessages: [],
//   notifications: [],
//   refreshTokens: [],
//   auditLogs: [],
//   supportTickets: [],
//   permissions: [],
//   rolePermissions: [],
//   listingImages: [],
//   recentlyViewed: [],
//   listingViews: [],
//   listingComments: [],
//   passwordResetTokens: [],
//   otpRequests: [],
//   deviceSessions: [],
//   apiUsageLogs: [],
//   fraudLogs: [],
//   supportTicketMessages: [],
//   reportedUsers: [],
//   reportedListings: [],
//   moderationQueue: [],
//   searchLogs: [],
//   shortLinks: [],
//   priceAlerts: [],
//   webhookEvents: [],
//   userVerifications: [],
//   adminNotes: [],
//   listingImportBatches: [],
//   listingImportRows: [],
//   systemConfig: [{ id: 1, key: 'maintenance_mode', value: 'false' }]
// };

// const autoIds = {
//   users: 3,
//   listings: 2,
//   categories: 5,
//   favorites: 1,
//   chatRooms: 1,
//   chatMessages: 1,
//   notifications: 1,
//   refreshTokens: 1,
//   auditLogs: 1,
//   supportTickets: 1,
//   permissions: 1,
//   rolePermissions: 1,
//   listingImages: 1,
//   recentlyViewed: 1,
//   listingViews: 1,
//   listingComments: 1,
//   passwordResetTokens: 1,
//   otpRequests: 1,
//   deviceSessions: 1,
//   apiUsageLogs: 1,
//   fraudLogs: 1,
//   supportTicketMessages: 1,
//   reportedUsers: 1,
//   reportedListings: 1,
//   moderationQueue: 1,
//   searchLogs: 1,
//   shortLinks: 1,
//   priceAlerts: 1,
//   webhookEvents: 1,
//   userVerifications: 1,
//   adminNotes: 1,
//   listingImportBatches: 1,
//   listingImportRows: 1,
//   systemConfig: 2
// };

// function getNextId(tableName) {
//   if (!autoIds[tableName]) {
//     autoIds[tableName] = 1;
//   }
//   const id = autoIds[tableName];
//   autoIds[tableName] = id + 1;
//   return id;
// }

// const createMockModel = (tableName) => ({
//   findMany: async (opts) => {
//     opts = opts || {};
//     let data = mockData[tableName] ? [...mockData[tableName]] : [];
    
//     if (opts.where) {
//       data = data.filter(item => {
//         return Object.keys(opts.where).every(k => {
//           const val = opts.where[k];
//           if (val && typeof val === 'object' && val.contains) {
//             return item[k] && item[k].toLowerCase().includes(val.contains.toLowerCase());
//           }
//           return item[k] === val;
//         });
//       });
//     }
    
//     if (opts.skip) data = data.slice(opts.skip);
//     if (opts.take) data = data.slice(0, opts.take);
    
//     return data;
//   },
  
//   findUnique: async (opts) => {
//     const key = Object.keys(opts.where)[0];
//     const data = mockData[tableName] || [];
//     const item = data.find(i => i[key] === opts.where[key]);
    
//     if (item && opts.include && opts.include.role) {
//       item.role = mockData.roles.find(r => r.id === item.roleId);
//     }
    
//     return item || null;
//   },
  
//   findFirst: async (opts) => {
//     opts = opts || {};
//     let data = mockData[tableName] || [];
    
//     if (opts.where) {
//       data = data.filter(item => {
//         return Object.keys(opts.where).every(k => item[k] === opts.where[k]);
//       });
//     }
    
//     const item = data[0] || null;
    
//     if (item && opts.include && opts.include.role) {
//       item.role = mockData.roles.find(r => r.id === item.roleId);
//     }
    
//     return item;
//   },
  
//   create: async (opts) => {
//     const newId = getNextId(tableName);
//     const newItem = {
//       id: newId,
//       ...opts.data,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     };
    
//     if (!mockData[tableName]) {
//       mockData[tableName] = [];
//     }
//     mockData[tableName].push(newItem);
    
//     return newItem;
//   },
  
//   update: async (opts) => {
//     const key = Object.keys(opts.where)[0];
//     const data = mockData[tableName] || [];
//     const idx = data.findIndex(i => i[key] === opts.where[key]);
    
//     if (idx !== -1) {
//       mockData[tableName][idx] = {
//         ...mockData[tableName][idx],
//         ...opts.data,
//         updatedAt: new Date()
//       };
//       return mockData[tableName][idx];
//     }
//     return null;
//   },
  
//   delete: async (opts) => {
//     const key = Object.keys(opts.where)[0];
//     const data = mockData[tableName] || [];
//     const idx = data.findIndex(i => i[key] === opts.where[key]);
    
//     if (idx !== -1) {
//       return mockData[tableName].splice(idx, 1)[0];
//     }
//     return null;
//   },
  
//   deleteMany: async (opts) => {
//     opts = opts || {};
//     if (!opts.where) {
//       const count = (mockData[tableName] || []).length;
//       mockData[tableName] = [];
//       return { count: count };
//     }
    
//     const before = (mockData[tableName] || []).length;
//     mockData[tableName] = (mockData[tableName] || []).filter(item => {
//       return !Object.keys(opts.where).every(k => item[k] === opts.where[k]);
//     });
//     return { count: before - mockData[tableName].length };
//   },
  
//   count: async (opts) => {
//     opts = opts || {};
//     let data = mockData[tableName] || [];
    
//     if (opts.where) {
//       data = data.filter(item => {
//         return Object.keys(opts.where).every(k => item[k] === opts.where[k]);
//       });
//     }
    
//     return data.length;
//   },
  
//   upsert: async (opts) => {
//     const model = createMockModel(tableName);
//     const existing = await model.findUnique({ where: opts.where });
    
//     if (existing) {
//       return model.update({ where: opts.where, data: opts.update });
//     } else {
//       return model.create({ data: opts.create });
//     }
//   }
// });

// const prisma = {
//   user: createMockModel('users'),
//   role: createMockModel('roles'),
//   permission: createMockModel('permissions'),
//   rolePermission: createMockModel('rolePermissions'),
//   listing: createMockModel('listings'),
//   listingImage: createMockModel('listingImages'),
//   category: createMockModel('categories'),
//   favorite: createMockModel('favorites'),
//   recentlyViewed: createMockModel('recentlyViewed'),
//   listingView: createMockModel('listingViews'),
//   listingComment: createMockModel('listingComments'),
//   chatRoom: createMockModel('chatRooms'),
//   chatMessage: createMockModel('chatMessages'),
//   notification: createMockModel('notifications'),
//   refreshToken: createMockModel('refreshTokens'),
//   passwordResetToken: createMockModel('passwordResetTokens'),
//   otpRequest: createMockModel('otpRequests'),
//   deviceSession: createMockModel('deviceSessions'),
//   auditLog: createMockModel('auditLogs'),
//   apiUsageLog: createMockModel('apiUsageLogs'),
//   fraudLog: createMockModel('fraudLogs'),
//   supportTicket: createMockModel('supportTickets'),
//   supportTicketMessage: createMockModel('supportTicketMessages'),
//   reportedUser: createMockModel('reportedUsers'),
//   reportedListing: createMockModel('reportedListings'),
//   moderationQueue: createMockModel('moderationQueue'),
//   searchLog: createMockModel('searchLogs'),
//   shortLink: createMockModel('shortLinks'),
//   priceAlert: createMockModel('priceAlerts'),
//   webhookEvent: createMockModel('webhookEvents'),
//   systemConfig: createMockModel('systemConfig'),
//   userVerification: createMockModel('userVerifications'),
//   adminNote: createMockModel('adminNotes'),
//   listingImportBatch: createMockModel('listingImportBatches'),
//   listingImportRow: createMockModel('listingImportRows'),
  
//   $connect: async () => {
//     console.log('📦 Mock Database Connected');
//   },
  
//   $disconnect: async () => {
//     console.log('📦 Mock Database Disconnected');
//   },
  
//   $transaction: async (operations) => {
//     if (Array.isArray(operations)) {
//       return Promise.all(operations);
//     }
//     return operations(prisma);
//   }
// };

// module.exports = { prisma, mockData };

// console.log('🧪 Using MOCK DATABASE - No real DB required');