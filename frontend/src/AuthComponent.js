import React, { useState } from 'react';
import styles from "./styles.js";

export default function AuthComponent({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault(); setError('');
    const endpoint = mode === 'login' ? '/login' : '/register';
    try {
      const res = await fetch('http://127.0.0.1:5000' + endpoint, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      if (mode==='login') onAuth({ token: data.token, email: data.email });
      else setMode('login');
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={styles.card}>
      <h2>{mode==='login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <input placeholder="email" value={email} onChange={e=>setemail(e.target.value)} required style={styles.input}/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={styles.input}/>
        {error && <div style={styles.errorText}>{error}</div>}
        <button type="submit" style={styles.button}>{mode==='login' ? 'Login' : 'Sign Up'}</button>
      </form>
      <div style={{ textAlign: 'center', margin: '15px 0', color: '#666', fontWeight: 'bold' }}>OR</div>
      <a
        href="http://127.0.0.1:5000/login/google"
        style={{
          ...styles.button,
          textDecoration: 'none',
          backgroundColor: '#4285F4', // Google's blue color
          textAlign: 'center',
          display: 'block' // Make the anchor tag behave like a button
        }}
      >
        Sign in with Google
      </a>
      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        {mode === 'login' ?
          <>
            Don't have an account?
            <span style={{ color: '#1877f2', cursor: 'pointer' }} onClick={() => { setMode('register'); setError(''); }}> Register</span>
            <span style={{ margin: '0 10px' }}>|</span>
            <a href="/reset-password" style={{ color: '#1877f2', cursor: 'pointer' }}>Forgot Password?</a>
          </>
          :
          <>
            Have an account?
            <span style={{ color: '#1877f2', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(''); }}> Login</span>
          </>
        }
      </p>
    </div>
  );
}
