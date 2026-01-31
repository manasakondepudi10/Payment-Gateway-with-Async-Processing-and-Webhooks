import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://api:8000';

export default function Checkout() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');
  const embedded = params.get('embedded') === 'true';

  const [order, setOrder] = useState(null);
  const [method, setMethod] = useState('');
  const [vpa, setVpa] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [paymentId, setPaymentId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | processing | success | failed
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) return;
      const res = await fetch(`${API_BASE}/api/v1/orders/${orderId}/public`);
      if (res.ok) {
        const json = await res.json();
        setOrder(json);
      }
    }
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    let interval;
    if (paymentId && status === 'processing') {
      interval = setInterval(async () => {
        const res = await fetch(`${API_BASE}/api/v1/payments/${paymentId}/public`);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success') {
            setStatus('success');
            if (embedded) window.parent.postMessage({ type: 'payment_success', data: json }, '*');
          }
          if (json.status === 'failed') {
            setStatus('failed');
            if (embedded) window.parent.postMessage({ type: 'payment_failed', data: json }, '*');
          }
        }
      }, 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [paymentId, status, embedded]);

  const amountDisplay = useMemo(() => {
    if (!order) return '₹0.00';
    return `₹${(order.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }, [order]);

  async function submitUPI(e) {
    e.preventDefault();
    if (!order) return;
    setStatus('processing');
    const res = await fetch(`${API_BASE}/api/v1/payments/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, method: 'upi', vpa }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus('failed');
      setErrorMessage(json.error?.description || 'Payment failed');
      return;
    }
    setPaymentId(json.id);
    setStatus('processing');
  }

  async function submitCard(e) {
    e.preventDefault();
    if (!order) return;
    setStatus('processing');
    const [expiry_month, expiry_year] = (card.expiry || '').split('/');
    const res = await fetch(`${API_BASE}/api/v1/payments/public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: order.id,
        method: 'card',
        card: {
          number: card.number,
          expiry_month,
          expiry_year,
          cvv: card.cvv,
          holder_name: card.name,
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStatus('failed');
      setErrorMessage(json.error?.description || 'Payment failed');
      return;
    }
    setPaymentId(json.id);
    setStatus('processing');
  }

  if (!orderId) return <div className="container">Missing order_id</div>;

  return (
    <div className="container">
      <div data-test-id="checkout-container" className="card">
        <div data-test-id="order-summary">
          <h2>Complete Payment</h2>
          <div>
            <span>Amount: </span>
            <span data-test-id="order-amount">{amountDisplay}</span>
          </div>
          <div>
            <span>Order ID: </span>
            <span data-test-id="order-id">{order?.id}</span>
          </div>
        </div>

        <div data-test-id="payment-methods" style={{ display: 'flex', gap: '10px', margin: '12px 0' }}>
          <button
            data-test-id="method-upi"
            data-method="upi"
            className="btn secondary"
            onClick={() => setMethod('upi')}
          >
            UPI
          </button>
          <button
            data-test-id="method-card"
            data-method="card"
            className="btn secondary"
            onClick={() => setMethod('card')}
          >
            Card
          </button>
        </div>

        <form data-test-id="upi-form" style={{ display: method === 'upi' ? 'block' : 'none' }} onSubmit={submitUPI}>
          <input
            data-test-id="vpa-input"
            placeholder="username@bank"
            type="text"
            value={vpa}
            onChange={(e) => setVpa(e.target.value)}
          />
          <button data-test-id="pay-button" className="btn" type="submit">Pay {amountDisplay}</button>
        </form>

        <form data-test-id="card-form" style={{ display: method === 'card' ? 'block' : 'none' }} onSubmit={submitCard}>
          <input
            data-test-id="card-number-input"
            placeholder="Card Number"
            type="text"
            value={card.number}
            onChange={(e) => setCard({ ...card, number: e.target.value })}
          />
          <input
            data-test-id="expiry-input"
            placeholder="MM/YY"
            type="text"
            value={card.expiry}
            onChange={(e) => setCard({ ...card, expiry: e.target.value })}
          />
          <input
            data-test-id="cvv-input"
            placeholder="CVV"
            type="text"
            value={card.cvv}
            onChange={(e) => setCard({ ...card, cvv: e.target.value })}
          />
          <input
            data-test-id="cardholder-name-input"
            placeholder="Name on Card"
            type="text"
            value={card.name}
            onChange={(e) => setCard({ ...card, name: e.target.value })}
          />
          <button data-test-id="pay-button" className="btn" type="submit">Pay {amountDisplay}</button>
        </form>

        <div data-test-id="processing-state" style={{ display: status === 'processing' ? 'flex' : 'none', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
          <div className="spinner" />
          <span data-test-id="processing-message">Processing payment...</span>
        </div>

        <div data-test-id="success-state" style={{ display: status === 'success' ? 'block' : 'none', marginTop: '12px' }}>
          <h2>Payment Successful!</h2>
          <div>
            <span>Payment ID: </span>
            <span data-test-id="payment-id">{paymentId}</span>
          </div>
          <span data-test-id="success-message">Your payment has been processed successfully</span>
        </div>

        <div data-test-id="error-state" style={{ display: status === 'failed' ? 'block' : 'none', marginTop: '12px' }}>
          <h2>Payment Failed</h2>
          <span data-test-id="error-message">{errorMessage || 'Payment could not be processed'}</span>
          <button data-test-id="retry-button" className="btn secondary" onClick={() => { setStatus('idle'); setPaymentId(null); }}>Try Again</button>
        </div>
      </div>
    </div>
  );
}
