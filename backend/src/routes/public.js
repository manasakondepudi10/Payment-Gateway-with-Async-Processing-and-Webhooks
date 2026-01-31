const express = require('express');
const { pool } = require('../db');
const { paymentQueue } = require('../queues');
const { generateId } = require('../utils/ids');
const { sendError } = require('../utils/errors');
const { isValidVPA, luhnCheck, detectCardNetwork, validateExpiry } = require('../utils/validation');

const router = express.Router();

router.get('/orders/:id/public', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Order not found');
    const order = result.rows[0];
    return res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/payments/public', async (req, res, next) => {
  try {
    const { order_id: orderId, method, vpa, card } = req.body || {};
    if (!orderId) return sendError(res, 400, 'BAD_REQUEST_ERROR', 'order_id is required');
    if (!method || !['upi', 'card'].includes(method)) return sendError(res, 400, 'BAD_REQUEST_ERROR', 'method must be upi or card');
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Order not found');
    const order = orderRes.rows[0];

    let cardNetwork = null;
    let cardLast4 = null;
    if (method === 'upi') {
      if (!isValidVPA(vpa)) return sendError(res, 400, 'INVALID_VPA', 'Invalid VPA format');
    }
    if (method === 'card') {
      if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder_name) {
        return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Card details incomplete');
      }
      const cleanNumber = card.number.replace(/[^0-9]/g, '');
      if (!luhnCheck(cleanNumber)) return sendError(res, 400, 'INVALID_CARD', 'Card validation failed');
      if (!validateExpiry(card.expiry_month, card.expiry_year)) return sendError(res, 400, 'EXPIRED_CARD', 'Card expiry date invalid');
      cardNetwork = detectCardNetwork(cleanNumber);
      cardLast4 = cleanNumber.slice(-4);
    }

    const id = generateId('pay');
    const now = new Date();
    const insert = await pool.query(
      `INSERT INTO payments (id, order_id, merchant_id, amount, currency, method, status, vpa, card_network, card_last4, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        order.id,
        order.merchant_id,
        order.amount,
        order.currency,
        method,
        method === 'upi' ? vpa : null,
        method === 'card' ? cardNetwork : null,
        method === 'card' ? cardLast4 : null,
        now,
        now,
      ]
    );
    const payment = insert.rows[0];
    await paymentQueue.add('process', { paymentId: payment.id }, { removeOnComplete: 100, removeOnFail: 100 });

    return res.status(201).json({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      vpa: payment.vpa,
      card_network: payment.card_network,
      card_last4: payment.card_last4,
      created_at: payment.created_at,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/payments/:id/public', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Payment not found');
    const payment = result.rows[0];
    return res.status(200).json({
      id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      vpa: payment.vpa,
      card_network: payment.card_network,
      card_last4: payment.card_last4,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
