const crypto = require('crypto');

function randomString(length) {
  const bytesNeeded = Math.ceil(length / 2);
  return crypto.randomBytes(bytesNeeded).toString('hex').slice(0, length);
}

function generateId(prefix) {
  return `${prefix}_${randomString(16)}`;
}

module.exports = {
  generateId,
};
