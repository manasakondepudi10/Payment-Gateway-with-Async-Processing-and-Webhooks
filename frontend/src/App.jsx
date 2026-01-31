import React, { useMemo, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Docs from './pages/Docs';
import Webhooks from './pages/Webhooks';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://api:8000';

function AppShell({ children }) {
  return (
    <div>
      <nav>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/dashboard/transactions">Transactions</Link>
        <Link to="/dashboard/webhooks">Webhooks</Link>
        <Link to="/dashboard/docs">Docs</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem('gatewaySession');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (session) localStorage.setItem('gatewaySession', JSON.stringify(session));
    else localStorage.removeItem('gatewaySession');
  }, [session]);

  const apiHeaders = useMemo(() => {
    if (!session) return {};
    return {
      'X-Api-Key': session.apiKey,
      'X-Api-Secret': session.apiSecret,
      'Content-Type': 'application/json',
    };
  }, [session]);

  const isAuthed = !!session;

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <Login
              onLogin={(email) => {
                setSession({
                  email,
                  apiKey: 'key_test_abc123',
                  apiSecret: 'secret_test_xyz789',
                });
              }}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthed ? (
              <AppShell>
                <Dashboard apiBase={API_BASE} headers={apiHeaders} session={session} />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/dashboard/transactions"
          element={
            isAuthed ? (
              <AppShell>
                <Transactions apiBase={API_BASE} headers={apiHeaders} />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/dashboard/docs"
          element={
            isAuthed ? (
              <AppShell>
                <Docs />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/dashboard/webhooks"
          element={
            isAuthed ? (
              <AppShell>
                <Webhooks apiBase={API_BASE} headers={apiHeaders} session={session} />
              </AppShell>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
