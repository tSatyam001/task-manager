const mongoose = require('mongoose');

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const missingFields = (body, fields) => fields.filter((field) => !body[field]);

module.exports = {
  isEmail,
  isObjectId,
  missingFields
};
