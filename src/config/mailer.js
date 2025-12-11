// ===========================================
// EMAIL MAILER CONFIGURATION (NODEMAILER)
// ===========================================

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { env } = require('./env');
const { logger } = require('./logger');

// Create transporter
const createTransporter = () => {
  // Return null if SMTP is not configured
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    logger.warn('SMTP not configured. Email sending disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

// Template cache
const templateCache = new Map();

// Load and compile email template
const getTemplate = (templateName) => {
  if (templateCache.has(templateName)) {
    return templateCache.get(templateName);
  }

  const templatePath = path.join(__dirname, '../templates/email', `${templateName}.hbs`);
  
  try {
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    templateCache.set(templateName, template);
    return template;
  } catch (error) {
    logger.error({ error, templateName }, 'Failed to load email template');
    return null;
  }
};

// Send email
const sendEmail = async ({ to, subject, template, data }) => {
  if (!transporter) {
    logger.warn({ to, subject }, 'Email not sent - SMTP not configured');
    return { success: false, reason: 'SMTP not configured' };
  }

  try {
    const compiledTemplate = getTemplate(template);
    
    if (!compiledTemplate) {
      throw new Error(`Template ${template} not found`);
    }

    const html = compiledTemplate({
      ...data,
      year: new Date().getFullYear(),
      frontendUrl: env.FRONTEND_URL,
    });

    const result = await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
    });

    logger.info({ to, subject, messageId: result.messageId }, 'Email sent successfully');
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error({ error, to, subject }, 'Failed to send email');
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  // Welcome email
  sendWelcome: async (user) => {
    return sendEmail({
      to: user.email,
      subject: 'Welcome to Marketplace!',
      template: 'welcome',
      data: {
        name: user.name,
        email: user.email,
      },
    });
  },

  // Password reset email
  sendPasswordReset: async (user, resetToken) => {
    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    return sendEmail({
      to: user.email,
      subject: 'Reset Your Password',
      template: 'password-reset',
      data: {
        name: user.name,
        resetLink,
        expiryMinutes: 60,
      },
    });
  },

  // Listing approved
  sendListingApproved: async (user, listing) => {
    const listingLink = `${env.FRONTEND_URL}/listings/${listing.id}`;
    return sendEmail({
      to: user.email,
      subject: 'Your Listing Has Been Approved!',
      template: 'listing-approved',
      data: {
        name: user.name,
        listingTitle: listing.title,
        listingLink,
      },
    });
  },

  // Listing rejected
  sendListingRejected: async (user, listing, reason) => {
    return sendEmail({
      to: user.email,
      subject: 'Your Listing Was Not Approved',
      template: 'listing-rejected',
      data: {
        name: user.name,
        listingTitle: listing.title,
        reason,
      },
    });
  },

  // Listing needs changes
  sendListingNeedsChanges: async (user, listing, changes) => {
    const editLink = `${env.FRONTEND_URL}/listings/${listing.id}/edit`;
    return sendEmail({
      to: user.email,
      subject: 'Changes Required for Your Listing',
      template: 'listing-needs-changes',
      data: {
        name: user.name,
        listingTitle: listing.title,
        changes,
        editLink,
      },
    });
  },

  // New chat message
  sendChatNotification: async (user, senderName, listingTitle) => {
    return sendEmail({
      to: user.email,
      subject: `New message from ${senderName}`,
      template: 'chat-message',
      data: {
        name: user.name,
        senderName,
        listingTitle,
        chatLink: `${env.FRONTEND_URL}/chat`,
      },
    });
  },

  // Support reply
  sendSupportReply: async (user, ticketSubject, replyMessage) => {
    return sendEmail({
      to: user.email,
      subject: `Re: ${ticketSubject}`,
      template: 'support-reply',
      data: {
        name: user.name,
        ticketSubject,
        replyMessage,
        supportLink: `${env.FRONTEND_URL}/support`,
      },
    });
  },

  // Price alert
  sendPriceAlert: async (user, listing, newPrice) => {
    const listingLink = `${env.FRONTEND_URL}/listings/${listing.id}`;
    return sendEmail({
      to: user.email,
      subject: 'Price Drop Alert!',
      template: 'price-alert',
      data: {
        name: user.name,
        listingTitle: listing.title,
        newPrice,
        listingLink,
      },
    });
  },

  // Listing expiry warning
  sendListingExpiryWarning: async (user, listing, daysLeft) => {
    const renewLink = `${env.FRONTEND_URL}/listings/${listing.id}/renew`;
    return sendEmail({
      to: user.email,
      subject: 'Your Listing is Expiring Soon',
      template: 'listing-expiry',
      data: {
        name: user.name,
        listingTitle: listing.title,
        daysLeft,
        renewLink,
      },
    });
  },
};

module.exports = { sendEmail, emailTemplates };