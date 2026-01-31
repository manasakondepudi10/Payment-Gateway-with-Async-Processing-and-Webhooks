const express = require('express');
const { pool } = require('../db');
const { refundQueue } = require('../queues');
const { generateId } = require('../utils/ids');
const { sendError } = require('../utils/errors');

const router = express.Router();

router.post('/payments/:paymentId/refunds', async (req, res, next) => {
  try {
    const paymentId = req.params.paymentId;
    const { amount, reason = null } = req.body || {};
    if (!Number.isInteger(amount) || amount <= 0) {
      return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Refund amount required');
    }
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1 AND merchant_id = $2', [paymentId, req.merchant.id]);
    if (payRes.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Payment not found');
    const payment = payRes.rows[0];
    if (payment.status !== 'success') return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Payment not in refundable state');

    const refunds = await pool.query(
      'SELECT SUM(amount) as total FROM refunds WHERE payment_id = $1 AND status IN (\'pending\', \'processed\')',
      [paymentId]
    );
    const refunded = parseInt(refunds.rows[0].total || '0', 10);
    if (amount > payment.amount - refunded) {
      return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Refund amount exceeds available amount');
    }

    const id = generateId('rfnd');
    const now = new Date();
    const insert = await pool.query(
      `INSERT INTO refunds (id, payment_id, merchant_id, amount, reason, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
      [id, paymentId, req.merchant.id, amount, reason, now]
    );
    const refund = insert.rows[0];
    await refundQueue.add('process', { refundId: refund.id }, { removeOnComplete: 100, removeOnFail: 100 });
    return res.status(201).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/refunds/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM refunds WHERE id = $1 AND merchant_id = $2', [req.params.id, req.merchant.id]);
    if (result.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Refund not found');
    const refund = result.rows[0];
    return res.status(200).json({
      id: refund.id,
      payment_id: refund.payment_id,
      amount: refund.amount,
      reason: refund.reason,
      status: refund.status,
      created_at: refund.created_at,
      processed_at: refund.processed_at,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
