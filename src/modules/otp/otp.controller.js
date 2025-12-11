// ===========================================
// OTP CONTROLLER
// ===========================================

const { otpService } = require('./otp.service');
const { asyncHandler } = require('../../middleware/errorHandler');
const { successResponse } = require('../../utils/response');

// Send OTP
const sendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await otpService.sendOTP(phone);
  successResponse(res, result, 'OTP sent successfully');
});

// Verify OTP
const verifyOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  const result = await otpService.verifyOTP(phone, otp);
  successResponse(res, result, 'OTP verified successfully');
});

// Resend OTP
const resendOTP = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  const result = await otpService.resendOTP(phone);
  successResponse(res, result, 'OTP resent successfully');
});

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
};