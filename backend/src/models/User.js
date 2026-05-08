const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      minlength: 6
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local'
    },
    googleId: {
      type: String,
      sparse: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    resetTokenHash: String,
    resetTokenExpires: Date,
    role: {
      type: String,
      enum: ['Admin', 'Member'],
      default: 'Member'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
