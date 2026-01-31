require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const dayjs = require('dayjs');
const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { pool } = require('./db');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
console.log('Worker using REDIS_URL:', redisUrl);

// Create a single Redis client for queue connections
const connection = new IORedis(redisUrl);

const paymentQueue = new Queue('payments', { connection });
const webhookQueue = new Queue('webhooks', { connection });
const refundQueue = new Queue('refunds', { connection });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getProcessingDelayMs() {
  if (process.env.TEST_MODE === 'true') {
    return parseInt(process.env.TEST_PROCESSING_DELAY || '1000', 10);
  }
  const min = parseInt(process.env.PROCESSING_DELAY_MIN || '5000', 10);
  const max = parseInt(process.env.PROCESSING_DELAY_MAX || '10000', 10);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldSucceed(method) {
  if (process.env.TEST_MODE === 'true') {
    return process.env.TEST_PAYMENT_SUCCESS !== 'false';
  }
  const rate = method === 'upi'
    ? parseFloat(process.env.UPI_SUCCESS_RATE || '0.9')
    : parseFloat(process.env.CARD_SUCCESS_RATE || '0.95');
  return Math.random() < rate;
}

function webhookDelayMs(attempt) {
  const testMode = process.env.WEBHOOK_RETRY_INTERVALS_TEST === 'true';
  if (testMode) {
    const schedule = [0, 5000, 10000, 15000, 20000];
    return schedule[Math.min(attempt - 1, schedule.length - 1)] || 0;
  }
  const schedule = [0, 60000, 300000, 1800000, 7200000];
  return schedule[Math.min(attempt - 1, schedule.length - 1)] || 0;
}

async function enqueueWebhook(merchantId, event, payload) {
  const log = await pool.query(
    `INSERT INTO webhook_logs (merchant_id, event, payload, status, attempts)
     VALUES ($1, $2, $3, 'pending', 0) RETURNING id`,
    [merchantId, event, payload]
  );
  const logId = log.rows[0].id;
  await webhookQueue.add('deliver', { logId }, { removeOnComplete: 200, removeOnFail: 200 });
}

async function processPayment(job) {
  const { paymentId } = job.data;
  const result = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
  if (result.rows.length === 0) return;
  const payment = result.rows[0];
  if (payment.status !== 'pending') return;

  await sleep(getProcessingDelayMs());
  const success = shouldSucceed(payment.method);

  const updates = {
    status: success ? 'success' : 'failed',
    error_code: success ? null : 'PAYMENT_FAILED',
    error_description: success ? null : 'Payment processing failed',
    updated_at: new Date(),
  };

  await pool.query(
    `UPDATE payments
     SET status = $1, error_code = $2, error_description = $3, updated_at = $4
     WHERE id = $5`,
    [updates.status, updates.error_code, updates.error_description, updates.updated_at, paymentId]
  );

  const refreshed = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
  const saved = refreshed.rows[0];
  const event = success ? 'payment.success' : 'payment.failed';
  await enqueueWebhook(saved.merchant_id, event, {
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data: { payment: saved },
  });
}

async function deliverWebhook(job) {
  const { logId } = job.data;
  const result = await pool.query('SELECT * FROM webhook_logs WHERE id = $1', [logId]);
  if (result.rows.length === 0) return;
  const log = result.rows[0];
  if (log.status === 'success') return;

  const merchantRes = await pool.query('SELECT webhook_url, webhook_secret FROM merchants WHERE id = $1', [log.merchant_id]);
  if (merchantRes.rows.length === 0) return;
  const merchant = merchantRes.rows[0];
  if (!merchant.webhook_url) {
    await pool.query('UPDATE webhook_logs SET status = $1, attempts = attempts + 1 WHERE id = $2', ['success', logId]);
    return;
  }

  const payloadString = JSON.stringify(log.payload);
  const signature = crypto.createHmac('sha256', merchant.webhook_secret || '').update(payloadString).digest('hex');

  let nextStatus = 'success';
  let responseCode = 200;
  let responseBody = '';
  try {
    const resp = await axios.post(merchant.webhook_url, log.payload, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature },
    });
    responseCode = resp.status;
    responseBody = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    if (resp.status < 200 || resp.status >= 300) nextStatus = 'failed';
  } catch (err) {
    nextStatus = 'pending';
    responseCode = err.response ? err.response.status : 500;
    responseBody = err.message;
  }

  const attempts = log.attempts + 1;
  const lastAttempt = dayjs().toISOString();
  let nextRetryAt = null;
  if (nextStatus === 'pending' && attempts < 5) {
    nextRetryAt = dayjs().add(webhookDelayMs(attempts + 1), 'millisecond').toISOString();
  }

  await pool.query(
    `UPDATE webhook_logs
     SET attempts = $1, last_attempt_at = $2, next_retry_at = $3, status = $4, response_code = $5, response_body = $6
     WHERE id = $7`,
    [attempts, lastAttempt, nextRetryAt, nextStatus === 'pending' && attempts >= 5 ? 'failed' : nextStatus, responseCode, responseBody, logId]
  );

  if (nextStatus === 'pending' && attempts < 5) {
    const delay = webhookDelayMs(attempts + 1);
    await webhookQueue.add('deliver', { logId }, { delay, removeOnComplete: 200, removeOnFail: 200 });
  }
}

async function processRefund(job) {
  const { refundId } = job.data;
  const refRes = await pool.query('SELECT * FROM refunds WHERE id = $1', [refundId]);
  if (refRes.rows.length === 0) return;
  const refund = refRes.rows[0];
  if (refund.status === 'processed') return;
  await sleep(3000 + Math.floor(Math.random() * 2000));
  const processedAt = new Date();
  await pool.query(
    'UPDATE refunds SET status = $1, processed_at = $2 WHERE id = $3',
    ['processed', processedAt, refundId]
  );
  const updated = await pool.query('SELECT * FROM refunds WHERE id = $1', [refundId]);
  const saved = updated.rows[0];
  const event = 'refund.processed';
  await enqueueWebhook(saved.merchant_id, event, {
    event,
    timestamp: Math.floor(Date.now() / 1000),
    data: { refund: saved },
  });
}

new Worker('payments', processPayment, { connection });
new Worker('webhooks', deliverWebhook, { connection });
new Worker('refunds', processRefund, { connection });

console.log('Worker started');
