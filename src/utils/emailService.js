// ===========================================
// EMAIL SERVICE - Brevo SMTP
// File: src/utils/emailService.js
// ===========================================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"${process.env.FROM_NAME || 'Dubilist'}" <${process.env.FROM_EMAIL || 'noreply@dubilist.ae'}>`;

// ===========================================
// SEND OTP EMAIL (Password Reset)
// ===========================================
const sendOTPEmail = async (email, otp, expiryMinutes = 10) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Your Dubilist Password Reset OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8;margin-bottom:8px">Password Reset OTP</h2>
        <p style="color:#374151">Use the code below to reset your password. It expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `,
  });
};

// ===========================================
// SEND PASSWORD RESET SUCCESS EMAIL
// ===========================================
const sendPasswordResetSuccessEmail = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Your Dubilist Password Has Been Reset',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#16a34a">Password Reset Successful</h2>
        <p style="color:#374151">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151">Your password has been successfully reset. You can now log in with your new password.</p>
        <p style="color:#6b7280;font-size:13px">If you didn't do this, contact support immediately at support@dubilist.ae</p>
      </div>
    `,
  });
};

// ===========================================
// SEND PHONE OTP EMAIL (fallback when no SMS)
// ===========================================
const sendPhoneOTPEmail = async (email, otp, phone, expiryMinutes = 10) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Your Dubilist Verification OTP',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px">
        <h2 style="color:#1d4ed8">Phone Verification OTP</h2>
        <p style="color:#374151">Use this OTP to verify your phone number <strong>${phone}</strong>. Expires in <strong>${expiryMinutes} minutes</strong>.</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#111827">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetSuccessEmail,
  sendPhoneOTPEmail,
};