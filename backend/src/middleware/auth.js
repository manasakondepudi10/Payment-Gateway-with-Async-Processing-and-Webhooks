const { pool } = require('../db');
const { sendError } = require('../utils/errors');

async function authenticate(req, res, next) {
  const apiKey = req.header('X-Api-Key');
  const apiSecret = req.header('X-Api-Secret');
  if (!apiKey || !apiSecret) {
    return sendError(res, 401, 'AUTHENTICATION_ERROR', 'Invalid API credentials');
  }
  try {
    const result = await pool.query(
      'SELECT * FROM merchants WHERE api_key = $1 AND api_secret = $2 AND is_active = TRUE',
      [apiKey, apiSecret]
    );
    if (result.rows.length === 0) {
      return sendError(res, 401, 'AUTHENTICATION_ERROR', 'Invalid API credentials');
    }
    req.merchant = result.rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  authenticate,
};
