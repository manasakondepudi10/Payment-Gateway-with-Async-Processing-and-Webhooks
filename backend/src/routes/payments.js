const express = require('express');
const dayjs = require('dayjs');
const { pool } = require('../db');
const { paymentQueue } = require('../queues');
const { generateId } = require('../utils/ids');
const { sendError } = require('../utils/errors');
const { isValidVPA, luhnCheck, detectCardNetwork, validateExpiry } = require('../utils/validation');

const router = express.Router();

async function getOrder(orderId, merchantId) {
  const result = await pool.query('SELECT * FROM orders WHERE id = $1 AND merchant_id = $2', [orderId, merchantId]);
  return result.rows[0];
}

function buildPaymentResponse(payment) {
  const base = {
    id: payment.id,
    order_id: payment.order_id,
    merchant_id: payment.merchant_id,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    captured: payment.captured,
    created_at: payment.created_at,
    updated_at: payment.updated_at,
  };
  if (payment.method === 'upi') {
    base.vpa = payment.vpa;
  }
  if (payment.method === 'card') {
    base.card_network = payment.card_network;
    base.card_last4 = payment.card_last4;
  }
  return base;
}

async function handleIdempotency(req, res) {
  const key = req.header('Idempotency-Key');
  if (!key) return null;
  const merchantId = req.merchant.id;
  const result = await pool.query(
    'SELECT response, expires_at FROM idempotency_keys WHERE merchant_id = $1 AND key = $2',
    [merchantId, key]
  );
  if (result.rows.length === 0) return null;
  const record = result.rows[0];
  if (dayjs(record.expires_at).isBefore(dayjs())) {
    await pool.query('DELETE FROM idempotency_keys WHERE merchant_id = $1 AND key = $2', [merchantId, key]);
    return null;
  }
  res.status(201).json(record.response);
  return 'returned';
}

async function saveIdempotency(req, responseBody) {
  const key = req.header('Idempotency-Key');
  if (!key) return;
  const merchantId = req.merchant.id;
  const expiresAt = dayjs().add(24, 'hour').toISOString();
  await pool.query(
    `INSERT INTO idempotency_keys (key, merchant_id, response, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (merchant_id, key) DO UPDATE SET response = EXCLUDED.response, expires_at = EXCLUDED.expires_at`,
    [key, merchantId, responseBody, expiresAt]
  );
}

async function createPaymentRecord(merchant, body) {
  const { order_id: orderId, method, vpa, card } = body || {};
  if (!orderId) return { error: ['BAD_REQUEST_ERROR', 'order_id is required', 400] };
  if (!method || !['upi', 'card'].includes(method)) return { error: ['BAD_REQUEST_ERROR', 'method must be upi or card', 400] };

  const order = await getOrder(orderId, merchant.id);
  if (!order) return { error: ['NOT_FOUND_ERROR', 'Order not found', 404] };

  let cardNetwork = null;
  let cardLast4 = null;
  if (method === 'upi') {
    if (!isValidVPA(vpa)) return { error: ['INVALID_VPA', 'Invalid VPA format', 400] };
  }
  if (method === 'card') {
    if (!card || !card.number || !card.expiry_month || !card.expiry_year || !card.cvv || !card.holder_name) {
      return { error: ['BAD_REQUEST_ERROR', 'Card details incomplete', 400] };
    }
    const cleanNumber = card.number.replace(/[^0-9]/g, '');
    if (!luhnCheck(cleanNumber)) return { error: ['INVALID_CARD', 'Card validation failed', 400] };
    if (!validateExpiry(card.expiry_month, card.expiry_year)) return { error: ['EXPIRED_CARD', 'Card expiry date invalid', 400] };
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
      merchant.id,
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
  return { payment };
}

router.post('/', async (req, res, next) => {
  try {
    const idem = await handleIdempotency(req, res);
    if (idem === 'returned') return;

    const result = await createPaymentRecord(req.merchant, req.body);
    if (result.error) {
      const [code, description, status] = result.error;
      return sendError(res, status, code, description);
    }

    const payment = result.payment;
    await paymentQueue.add('process', { paymentId: payment.id }, { removeOnComplete: 100, removeOnFail: 100 });

    const responseBody = buildPaymentResponse(payment);
    await saveIdempotency(req, responseBody);
    return res.status(201).json(responseBody);
  } catch (err) {
    return next(err);
  }
});

router.post('/public', async (req, res, next) => {
  try {
    const { order_id: orderId } = req.body || {};
    if (!orderId) return sendError(res, 400, 'BAD_REQUEST_ERROR', 'order_id is required');
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Order not found');
    const merchant = { id: orderResult.rows[0].merchant_id };
    const result = await createPaymentRecord(merchant, req.body);
    if (result.error) {
      const [code, description, status] = result.error;
      return sendError(res, status, code, description);
    }
    const payment = result.payment;
    await paymentQueue.add('process', { paymentId: payment.id }, { removeOnComplete: 100, removeOnFail: 100 });
    return res.status(201).json(buildPaymentResponse(payment));
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1 AND merchant_id = $2',
      [req.params.id, req.merchant.id]
    );
    if (result.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Payment not found');
    return res.status(200).json(buildPaymentResponse(result.rows[0]));
  } catch (err) {
    return next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const result = await pool.query(
      'SELECT * FROM payments WHERE merchant_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.merchant.id, limit]
    );
    return res.status(200).json({ data: result.rows.map(buildPaymentResponse) });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/capture', async (req, res, next) => {
  try {
    const { amount } = req.body || {};
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1 AND merchant_id = $2', [req.params.id, req.merchant.id]);
    if (payRes.rows.length === 0) return sendError(res, 404, 'NOT_FOUND_ERROR', 'Payment not found');
    const payment = payRes.rows[0];
    if (payment.status !== 'success' || payment.captured) {
      return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Payment not in capturable state');
    }
    if (amount && amount !== payment.amount) {
      return sendError(res, 400, 'BAD_REQUEST_ERROR', 'Capture amount mismatch');
    }
    const updated = await pool.query(
      `UPDATE payments SET captured = TRUE, updated_at = $1 WHERE id = $2 RETURNING *`,
      [new Date(), req.params.id]
    );
    return res.status(200).json({
      ...buildPaymentResponse(updated.rows[0]),
      captured: true,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
