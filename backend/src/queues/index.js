const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
console.log('Queue using REDIS_URL:', redisUrl);

// Create a single Redis client for queue connections
const connection = new IORedis(redisUrl);

const paymentQueue = new Queue('payments', { connection });
const webhookQueue = new Queue('webhooks', { connection });
const refundQueue = new Queue('refunds', { connection });

module.exports = {
  paymentQueue,
  webhookQueue,
  refundQueue,
};
