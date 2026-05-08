const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { isEmail, missingFields } = require('../utils/validators');

const router = express.Router();

const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
});

router.post('/signup', async (req, res) => {
  const { name, email, password, role } = req.body;
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

  if (role && !['Admin', 'Member'].includes(role)) {
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
    role: role || 'Member'
  });

  res.status(201).json({
    token: createToken(user._id),
    user: userResponse(user)
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const missing = missingFields(req.body, ['email', 'password']);

  if (missing.length) {
    return res.status(400).json({ message: `Missing field(s): ${missing.join(', ')}` });
  }

  const user = await User.findOne({ email });
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!user || !passwordMatches) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({
    token: createToken(user._id),
    user: userResponse(user)
  });
});

router.get('/me', protect, (req, res) => {
  res.json({ user: userResponse(req.user) });
});

router.get('/users', protect, async (req, res) => {
  const users = await User.find().select('name email role').sort({ name: 1 });
  res.json(users);
});

module.exports = router;
