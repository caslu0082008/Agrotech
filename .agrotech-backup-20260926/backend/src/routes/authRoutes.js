const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, readLimiter } = require('../middleware/rateLimit');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, registerValidator, validate, controller.register);
router.post('/login', authLimiter, loginValidator, validate, controller.login);
router.post('/logout', controller.logout);
router.get('/me', readLimiter, requireAuth, controller.me);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, controller.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidator, validate, controller.resetPassword);

module.exports = router;
