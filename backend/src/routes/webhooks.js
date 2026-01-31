const express = require('express');
const { pool } = require('../db');
const { webhookQueue } = require('../queues');
const { sendError } = require('../utils/errors');

const router = express.Router();

router.get('/webhooks', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const dataRes = await pool.query(
      `SELECT id, event, status, attempts, created_at, last_attempt_at, response_code
       FROM webhook_logs
       WHERE merchant_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.merchant.id, limit, offset]
    );
    const countRes = await pool.query('SELECT COUNT(*) FROM webhook_logs WHERE merchant_id = $1', [req.merchant.id]);
    return res.status(200).json({
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/webhooks/:id/retry', async (req, res, next) => {
  try {
    const id = req.params.id;
    const logRes = await pool.query('SELECT * FROM webhook_logs WHERE id = $1 AND merchant_id = $2', [id, req.merchant.id]);
    if (logRes.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Webhook log not found');
    await pool.query(
      `UPDATE webhook_logs SET status = 'pending', attempts = 0, next_retry_at = NULL WHERE id = $1`,
      [id]
    );
    await webhookQueue.add('deliver', { logId: id }, { removeOnComplete: 200, removeOnFail: 200 });
    return res.status(200).json({ id, status: 'pending', message: 'Webhook retry scheduled' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
