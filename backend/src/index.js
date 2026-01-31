require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { runMigrations, seedTestMerchant } = require('./db');
const { health } = require('./routes/health');
const testRouter = require('./routes/test');
const publicRouter = require('./routes/public');
const { authenticate } = require('./middleware/auth');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const refundsRouter = require('./routes/refunds');
const webhooksRouter = require('./routes/webhooks');
const merchantRouter = require('./routes/merchant');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', health);
app.use('/api/v1/test', testRouter);
app.use('/api/v1', publicRouter);

app.use('/api/v1/orders', authenticate, ordersRouter);
app.use('/api/v1/payments', authenticate, paymentsRouter);
app.use('/api/v1', authenticate, refundsRouter);
app.use('/api/v1', authenticate, webhooksRouter);
app.use('/api/v1', authenticate, merchantRouter);

app.use((err, req, res, _next) => {
  // Generic error handler
  console.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      description: 'Internal server error',
    },
  });
});

async function start() {
  await runMigrations();
  await seedTestMerchant();
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`API listening on ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
