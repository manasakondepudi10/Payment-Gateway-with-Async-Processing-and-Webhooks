const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

router.get('/merchant/webhook', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1', [req.merchant.id]);
    const merchant = result.rows[0];
    return res.status(200).json({
      webhook_url: merchant.webhook_url,
      webhook_secret: merchant.webhook_secret,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/merchant/webhook', async (req, res, next) => {
  try {
    const { webhook_url: webhookUrl } = req.body || {};
    await pool.query('UPDATE merchants SET webhook_url = $1, updated_at = NOW() WHERE id = $2', [webhookUrl, req.merchant.id]);
    return res.status(200).json({ webhook_url: webhookUrl });
  } catch (err) {
    return next(err);
  }
});

router.post('/merchant/webhook/regenerate', async (req, res, next) => {
  try {
    const secret = crypto.randomBytes(16).toString('hex');
    await pool.query('UPDATE merchants SET webhook_secret = $1, updated_at = NOW() WHERE id = $2', [secret, req.merchant.id]);
    return res.status(200).json({ webhook_secret: secret });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
