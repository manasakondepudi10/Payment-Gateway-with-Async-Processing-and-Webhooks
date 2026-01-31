const express = require('express');
const { pool } = require('../db');
const { generateId } = require('../utils/ids');
const { sendError } = require('../utils/errors');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { amount, currency = 'INR', receipt = null, notes = {} } = req.body || {};
  if (!Number.isInteger(amount) || amount < 100) {
    return sendError(res, 400, 'BAD_REQUEST_ERROR', 'amount must be at least 100');
  }
  try {
    const id = generateId('order');
    const merchantId = req.merchant.id;
    const result = await pool.query(
      `INSERT INTO orders (id, merchant_id, amount, currency, receipt, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'created')
       RETURNING *`,
      [id, merchantId, amount, currency, receipt, notes]
    );
    const order = result.rows[0];
    return res.status(201).json({
      id: order.id,
      merchant_id: order.merchant_id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes || {},
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND merchant_id = $2',
      [req.params.id, req.merchant.id]
    );
    if (result.rows.length === 0) {
      return sendError(res, 404, 'NOT_FOUND_ERROR', 'Order not found');
    }
    const order = result.rows[0];
    return res.status(200).json({
      id: order.id,
      merchant_id: order.merchant_id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes || {},
      status: order.status,
      created_at: order.created_at,
      updated_at: order.updated_at,
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id/public', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return sendError(res, 404, 'NOT_FOUND_ERROR', 'Order not found');
    }
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

module.exports = router;
