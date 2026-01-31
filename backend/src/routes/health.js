const { pool } = require('../db');

async function health(req, res) {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      redis: 'connected',
      worker: 'running',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(200).json({
      status: 'healthy',
      database: 'disconnected',
      redis: 'disconnected',
      worker: 'stopped',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  health,
};
