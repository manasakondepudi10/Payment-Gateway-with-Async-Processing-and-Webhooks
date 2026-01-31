const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { paymentQueue, webhookQueue, refundQueue } = require('../queues');

router.get('/merchant', testMerchant);
router.get('/jobs/status', jobsStatus);

async function testMerchant(req, res, next) {
  try {
    const email = process.env.TEST_MERCHANT_EMAIL || 'test@example.com';
    const result = await pool.query(
      'SELECT id, email, api_key FROM merchants WHERE email = $1 LIMIT 1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ seeded: false });
    }
    const merchant = result.rows[0];
    return res.status(200).json({
      id: merchant.id,
      email: merchant.email,
      api_key: merchant.api_key,
      seeded: true,
    });
  } catch (err) {
    return next(err);
  }
}

async function jobsStatus(req, res, next) {
  try {
    let stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      worker_status: 'running',
      timestamp: new Date().toISOString(),
    };

    try {
      const payCounts = await paymentQueue.getJobCounts('wait', 'active', 'completed', 'failed');
      const whCounts = await webhookQueue.getJobCounts('wait', 'active', 'completed', 'failed');
      const rfCounts = await refundQueue.getJobCounts('wait', 'active', 'completed', 'failed');

      stats.pending = (payCounts.wait || 0) + (whCounts.wait || 0) + (rfCounts.wait || 0);
      stats.processing = (payCounts.active || 0) + (whCounts.active || 0) + (rfCounts.active || 0);
      stats.completed = (payCounts.completed || 0) + (whCounts.completed || 0) + (rfCounts.completed || 0);
      stats.failed = (payCounts.failed || 0) + (whCounts.failed || 0) + (rfCounts.failed || 0);
    } catch (queueErr) {
      console.error('Error getting queue stats:', queueErr.message);
      stats.worker_status = 'error';
    }

    return res.status(200).json(stats);
  } catch (err) {
    console.error('Error in jobsStatus:', err);
    return next(err);
  }
}

module.exports = router;
