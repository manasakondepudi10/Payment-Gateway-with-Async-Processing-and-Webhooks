const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

async function seedTestMerchant() {
  const email = process.env.TEST_MERCHANT_EMAIL || 'test@example.com';
  const apiKey = process.env.TEST_API_KEY || 'key_test_abc123';
  const apiSecret = process.env.TEST_API_SECRET || 'secret_test_xyz789';
  const id = process.env.TEST_MERCHANT_ID || '550e8400-e29b-41d4-a716-446655440000';
  const webhookSecret = process.env.TEST_WEBHOOK_SECRET || 'whsec_test_abc123';

  const existing = await pool.query('SELECT id FROM merchants WHERE email = $1', [email]);
  if (existing.rows.length > 0) return existing.rows[0];

  await pool.query(
    `INSERT INTO merchants (id, name, email, api_key, api_secret, webhook_secret)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, 'Test Merchant', email, apiKey, apiSecret, webhookSecret]
  );
  return { id };
}

module.exports = {
  pool,
  runMigrations,
  seedTestMerchant,
};
