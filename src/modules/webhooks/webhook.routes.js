// ===========================================
// WEBHOOKS ROUTES
// ===========================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../../config/database');
const { logger } = require('../../config/logger');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse } = require('../../utils/response');
const { verifyHmacSignature } = require('../../utils/crypto');
const { env } = require('../../config/env');

// Webhook signature verification middleware
const verifyWebhookSignature = (secretKey) => {
  return (req, res, next) => {
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    
    if (!signature) {
      logger.warn({ path: req.path }, 'Webhook received without signature');
      // Allow for development, but log warning
      if (env.NODE_ENV === 'production') {
        return res.status(401).json({ error: 'Missing signature' });
      }
    }

    // Verify signature if provided
    if (signature && secretKey) {
      const payload = JSON.stringify(req.body);
      try {
        const isValid = verifyHmacSignature(payload, secretKey, signature);
        if (!isValid) {
          logger.warn({ path: req.path }, 'Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } catch (error) {
        logger.error({ error }, 'Signature verification failed');
      }
    }

    next();
  };
};

// Payment webhook
router.post(
  '/payment',
  verifyWebhookSignature(env.PAYMENT_WEBHOOK_SECRET),
  asyncHandler(async (req, res) => {
    const { type, data, id: externalId } = req.body;

    // Log webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        type: `payment.${type || 'unknown'}`,
        externalId,
        payload: req.body,
        status: 'received',
      },
    });

    logger.info({ webhookId: webhookEvent.id, type }, 'Payment webhook received');

    // Process webhook asynchronously
    processPaymentWebhook(webhookEvent.id, req.body).catch(err => {
      logger.error({ err, webhookId: webhookEvent.id }, 'Webhook processing failed');
    });

    // Respond immediately
    successResponse(res, { received: true, webhookId: webhookEvent.id });
  })
);

// Generic webhook endpoint
router.post(
  '/:provider',
  asyncHandler(async (req, res) => {
    const { provider } = req.params;

    // Log webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        type: provider,
        externalId: req.body.id || req.body.event_id,
        payload: req.body,
        status: 'received',
      },
    });

    logger.info({ webhookId: webhookEvent.id, provider }, 'Webhook received');

    successResponse(res, { received: true, webhookId: webhookEvent.id });
  })
);

// Process payment webhook
async function processPaymentWebhook(webhookId, payload) {
  try {
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: { status: 'processing' },
    });

    const { type, data } = payload;

    switch (type) {
      case 'payment.completed':
        // Handle successful payment
        // e.g., activate listing boost, premium features, etc.
        if (data.listingId) {
          await prisma.listing.update({
            where: { id: parseInt(data.listingId, 10) },
            data: {
              boostedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
          });
        }
        break;

      case 'payment.failed':
        // Handle failed payment
        logger.warn({ data }, 'Payment failed');
        break;

      case 'payment.refunded':
        // Handle refund
        if (data.listingId) {
          await prisma.listing.update({
            where: { id: parseInt(data.listingId, 10) },
            data: { boostedUntil: null },
          });
        }
        break;

      default:
        logger.info({ type }, 'Unknown payment webhook type');
    }

    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: { status: 'processed', processedAt: new Date() },
    });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id: webhookId },
      data: {
        status: 'failed',
        lastError: error.message,
        attempts: { increment: 1 },
      },
    });
    throw error;
  }
}

module.exports = router;