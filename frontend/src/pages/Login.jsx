import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    if (email === 'test@example.com') {
      onLogin(email, password);
      navigate('/dashboard');
    }
  }

  return (
    <main>
      <form data-test-id="login-form" className="form" onSubmit={handleSubmit}>
        <input
          data-test-id="email-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          data-test-id="password-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button data-test-id="login-button" type="submit">Login</button>
      </form>
    </main>
  );
}
