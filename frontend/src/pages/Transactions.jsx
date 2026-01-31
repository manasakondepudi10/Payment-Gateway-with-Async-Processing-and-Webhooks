import React, { useEffect, useState } from 'react';

export default function Transactions({ apiBase, headers }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${apiBase}/api/v1/payments?limit=200`, { headers });
        if (!res.ok) return;
        const json = await res.json();
        setRows(json.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [apiBase, headers]);

  return (
    <div className="card">
      <table data-test-id="transactions-table" className="table">
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>Order ID</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} data-test-id="transaction-row" data-payment-id={p.id}>
              <td data-test-id="payment-id">{p.id}</td>
              <td data-test-id="order-id">{p.order_id}</td>
              <td data-test-id="amount">{p.amount}</td>
              <td data-test-id="method">{p.method}</td>
              <td data-test-id="status">{p.status}</td>
              <td data-test-id="created-at">{new Date(p.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
