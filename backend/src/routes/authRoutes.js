const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { sendOtpEmail } = require('../utils/mailer');
const { isEmail, missingFields } = require('../utils/validators');

const router = express.Router();
const OTP_TTL_MS = 10 * 60 * 1000;

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider
});

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const createOtp = () => String(crypto.randomInt(100000, 1000000));

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const isValidRole = (role) => !role || ['Admin', 'Member'].includes(role);

const googleClientId = () => (process.env.GOOGLE_CLIENT_ID || '').trim();

const googleClientIdProblem = () => {
  const clientId = googleClientId();

  if (!clientId) return 'Google OAuth is not configured on the server';
  if (!clientId.endsWith('.apps.googleusercontent.com')) return 'Google OAuth client ID must end with .apps.googleusercontent.com';
  if (/your_|1234567890|x{4,}|example/i.test(clientId)) return 'Google OAuth client ID still looks like a placeholder. Create a Web application OAuth client in Google Cloud and paste its real Client ID.';
  return '';
};

const issueAuth = (user) => ({
  token: createToken(user._id),
  user: userResponse(user)
});

const otpResponse = (mailResult, otp) => ({
  message: mailResult.delivered
    ? 'OTP sent to your email'
    : 'OTP generated. Configure SMTP to email it automatically; check the backend console for local development.',
  ...(process.env.NODE_ENV !== 'production' && !mailResult.delivered ? { devOtp: otp } : {})
});

router.get('/config', (req, res) => {
  const configProblem = googleClientIdProblem();

  res.json({
    googleClientId: configProblem ? '' : googleClientId(),
    googleOAuthEnabled: !configProblem,
    googleOAuthMessage: configProblem
  });
});

router.post('/signup', async (req, res) => {
  const { name, password, role } = req.body;
  const email = normalizeEmail(req.body.email);
  const missing = missingFields(req.body, ['name', 'email', 'password']);

  if (missing.length) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(', ')}` });
  }

  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  if (!isValidRole(role)) {
    return res.status(400).json({ message: 'Role must be Admin or Member' });
  }

  const exists = await User.findOne({ email });
  if (exists) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    authProvider: 'local',
    role: role || 'Member'
  });

  res.status(201).json(issueAuth(user));
});

router.post('/login', async (req, res) => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);
  const missing = missingFields(req.body, ['email', 'password']);

  if (missing.length) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(', ')}` });
  }

  const user = await User.findOne({ email });
  const passwordMatches = user?.password ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json(issueAuth(user));
});

router.post('/otp/request', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: 'No account found for this email' });
  }

  const otp = createOtp();
  user.loginOtpHash = hashOtp(otp);
  user.loginOtpExpires = new Date(Date.now() + OTP_TTL_MS);
  await user.save();

  const mailResult = await sendOtpEmail({
    to: user.email,
    otp,
    subject: 'Your login OTP',
    purpose: 'login'
  });

  res.json(otpResponse(mailResult, otp));
});

router.post('/otp/verify', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  const user = await User.findOne({ email });
  const validOtp = user?.loginOtpHash === hashOtp(otp);
  const validExpiry = user?.loginOtpExpires && user.loginOtpExpires > new Date();

  if (!user || !validOtp || !validExpiry) {
    return res.status(401).json({ message: 'Invalid or expired OTP' });
  }

  user.loginOtpHash = undefined;
  user.loginOtpExpires = undefined;
  user.emailVerified = true;
  await user.save();

  res.json(issueAuth(user));
});

router.post('/forgot-password/request', async (req, res) => {
  const email = normalizeEmail(req.body.email);

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }

  const user = await User.findOne({ email });

  if (user) {
    const otp = createOtp();
    user.resetOtpHash = hashOtp(otp);
    user.resetOtpExpires = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    const mailResult = await sendOtpEmail({
      to: user.email,
      otp,
      subject: 'Reset your password',
      purpose: 'password reset'
    });

    return res.json(otpResponse(mailResult, otp));
  }

  res.json({ message: 'If an account exists for this email, a reset OTP will be sent.' });
});

router.post('/forgot-password/reset', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { otp, password } = req.body;

  if (!email || !otp || !password) {
    return res.status(400).json({ message: 'Email, OTP, and new password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const user = await User.findOne({ email });
  const validOtp = user?.resetOtpHash === hashOtp(otp);
  const validExpiry = user?.resetOtpExpires && user.resetOtpExpires > new Date();

  if (!user || !validOtp || !validExpiry) {
    return res.status(401).json({ message: 'Invalid or expired reset OTP' });
  }

  user.password = await bcrypt.hash(password, 10);
  user.authProvider = user.authProvider || 'local';
  user.resetOtpHash = undefined;
  user.resetOtpExpires = undefined;
  await user.save();

  res.json(issueAuth(user));
});

router.post('/google', async (req, res) => {
  const { credential, role } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required' });
  }

  const configProblem = googleClientIdProblem();

  if (configProblem) {
    return res.status(500).json({ message: configProblem });
  }

  if (!isValidRole(role)) {
    return res.status(400).json({ message: 'Role must be Admin or Member' });
  }

  const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  const profile = await googleRes.json().catch(() => ({}));

  if (!googleRes.ok || profile.aud !== googleClientId() || !['true', true].includes(profile.email_verified)) {
    return res.status(401).json({ message: 'Invalid Google sign-in token' });
  }

  const email = normalizeEmail(profile.email);
  let user = await User.findOne({ $or: [{ email }, { googleId: profile.sub }] });

  if (!user) {
    user = await User.create({
      name: profile.name || email.split('@')[0],
      email,
      googleId: profile.sub,
      authProvider: 'google',
      emailVerified: true,
      role: role || 'Member'
    });
  } else if (user.googleId && user.googleId !== profile.sub) {
    return res.status(409).json({
      code: 'GOOGLE_EMAIL_EXISTS',
      message: 'This Gmail address is already linked to another Google account. Choose another Gmail account.'
    });
  } else if (!user.googleId && user.authProvider !== 'google') {
    return res.status(409).json({
      code: 'GOOGLE_EMAIL_EXISTS',
      message: 'This Gmail address is already registered. Login with your password or choose another Gmail account.'
    });
  } else {
    user.googleId = user.googleId || profile.sub;
    user.emailVerified = true;
    await user.save();
  }

  res.json(issueAuth(user));
});

router.get('/me', protect, (req, res) => {
  res.json({ user: userResponse(req.user) });
});

router.get('/users', protect, async (req, res) => {
  const users = await User.find().select('name email role').sort({ name: 1 });
  res.json(users);
});

module.exports = router;
