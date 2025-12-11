// ===========================================
// SHORT LINK ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { asyncHandler } = require('../../middleware/errorHandler');
const { ApiError } = require('../../middleware/errorHandler');
const { env } = require('../../config/env');
const { generateShortCode } = require('../../utils/crypto');

// Redirect short link
router.get('/:shortCode', asyncHandler(async (req, res) => {
  const { shortCode } = req.params;

  const shortLink = await prisma.shortLink.findUnique({
    where: { shortCode },
  });

  if (!shortLink) {
    throw new ApiError(404, 'LINK_NOT_FOUND', 'Short link not found');
  }

  // Check expiry
  if (shortLink.expiresAt && shortLink.expiresAt < new Date()) {
    throw new ApiError(410, 'LINK_EXPIRED', 'This link has expired');
  }

  // Increment click count
  await prisma.shortLink.update({
    where: { id: shortLink.id },
    data: { clicks: { increment: 1 } },
  });

  // Generate redirect URL
  let redirectUrl;
  switch (shortLink.targetType) {
    case 'listing':
      redirectUrl = `${env.FRONTEND_URL}/listings/${shortLink.targetId}`;
      break;
    case 'profile':
      redirectUrl = `${env.FRONTEND_URL}/users/${shortLink.targetId}`;
      break;
    default:
      redirectUrl = env.FRONTEND_URL;
  }

  res.redirect(301, redirectUrl);
}));

// Create short link (for API use)
const createShortLink = async (targetType, targetId, expiresAt = null) => {
  const shortCode = generateShortCode(8);

  const shortLink = await prisma.shortLink.create({
    data: {
      shortCode,
      targetType,
      targetId,
      expiresAt,
    },
  });

  return {
    shortCode,
    shortUrl: `${env.FRONTEND_URL}/l/${shortCode}`,
    expiresAt,
  };
};

module.exports = router;
module.exports.createShortLink = createShortLink;