import React, { useEffect, useState } from 'react';

export default function Webhooks({ apiBase, headers, session }) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [logs, setLogs] = useState([]);

  async function loadConfig() {
    try {
      const res = await fetch(`${apiBase}/api/v1/merchant/webhook`, { headers });
      if (res.ok) {
        const json = await res.json();
        setWebhookUrl(json.webhook_url || '');
        setSecret(json.webhook_secret || '');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadLogs() {
    try {
      const res = await fetch(`${apiBase}/api/v1/webhooks?limit=10&offset=0`, { headers });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadConfig();
    loadLogs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveConfig(e) {
    e.preventDefault();
    await fetch(`${apiBase}/api/v1/merchant/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
    loadConfig();
  }

  async function regenerate() {
    const res = await fetch(`${apiBase}/api/v1/merchant/webhook/regenerate`, { method: 'POST', headers });
    if (res.ok) {
      const json = await res.json();
      setSecret(json.webhook_secret);
    }
  }

  async function retry(logId) {
    await fetch(`${apiBase}/api/v1/webhooks/${logId}/retry`, { method: 'POST', headers });
    loadLogs();
  }

  return (
    <div data-test-id="webhook-config" className="card">
      <h2>Webhook Configuration</h2>
      <form data-test-id="webhook-config-form" className="form" onSubmit={saveConfig}>
        <div>
          <label>Webhook URL</label>
          <input
            data-test-id="webhook-url-input"
            type="url"
            placeholder="https://yoursite.com/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>
        <div>
          <label>Webhook Secret</label>
          <span data-test-id="webhook-secret" style={{ display: 'block', marginTop: '4px' }}>{secret}</span>
          <button data-test-id="regenerate-secret-button" type="button" onClick={regenerate}>Regenerate</button>
        </div>
        <button data-test-id="save-webhook-button" type="submit">Save Configuration</button>
        <button data-test-id="test-webhook-button" type="button" onClick={loadLogs}>Send Test Webhook</button>
      </form>

      <h3>Webhook Logs</h3>
      <table data-test-id="webhook-logs-table" className="table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Last Attempt</th>
            <th>Response Code</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} data-test-id="webhook-log-item" data-webhook-id={log.id}>
              <td data-test-id="webhook-event">{log.event}</td>
              <td data-test-id="webhook-status">{log.status}</td>
              <td data-test-id="webhook-attempts">{log.attempts}</td>
              <td data-test-id="webhook-last-attempt">{log.last_attempt_at ? new Date(log.last_attempt_at).toLocaleString() : '-'}</td>
              <td data-test-id="webhook-response-code">{log.response_code || '-'}</td>
              <td>
                <button
                  data-test-id="retry-webhook-button"
                  data-webhook-id={log.id}
                  type="button"
                  onClick={() => retry(log.id)}
                >
                  Retry
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
