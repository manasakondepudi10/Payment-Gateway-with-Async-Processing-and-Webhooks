import React, { useEffect, useState } from 'react';

export default function Dashboard({ apiBase, headers, session }) {
  const [stats, setStats] = useState({ total: 0, amount: 0, successRate: 0 });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/api/v1/payments?limit=200`, { headers });
        if (!res.ok) return;
        const json = await res.json();
        const payments = json.data || [];
        const total = payments.length;
        const success = payments.filter((p) => p.status === 'success');
        const amount = success.reduce((sum, p) => sum + (p.amount || 0), 0);
        const successRate = total === 0 ? 0 : Math.round((success.length / total) * 100);
        setStats({ total, amount, successRate });
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [apiBase, headers]);

  const formattedAmount = `₹${(stats.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div data-test-id="dashboard" className="card">
      <div data-test-id="api-credentials" style={{ display: 'flex', gap: '24px' }}>
        <div>
          <label>API Key</label>
          <div data-test-id="api-key">{session.apiKey}</div>
        </div>
        <div>
          <label>API Secret</label>
          <div data-test-id="api-secret">{session.apiSecret}</div>
        </div>
      </div>

      <div data-test-id="stats-container" style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <div data-test-id="total-transactions" className="card" style={{ minWidth: '120px' }}>
          {stats.total}
        </div>
        <div data-test-id="total-amount" className="card" style={{ minWidth: '120px' }}>
          {formattedAmount}
        </div>
        <div data-test-id="success-rate" className="card" style={{ minWidth: '120px' }}>
          {stats.successRate}%
        </div>
      </div>
    </div>
  );
}
