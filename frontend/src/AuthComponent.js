import React, { useState } from 'react';
import styles from "./styles.js";

export default function AuthComponent({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault(); setError('');
    const endpoint = mode === 'login' ? '/login' : '/register';
    try {
      const res = await fetch('http://127.0.0.1:5000' + endpoint, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error');
      if (mode==='login') onAuth({ token: data.token, username: data.username });
      else setMode('login');
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={styles.card}>
      <h2>{mode==='login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} required style={styles.input}/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={styles.input}/>
        {error && <div style={styles.errorText}>{error}</div>}
        <button type="submit" style={styles.button}>{mode==='login' ? 'Login' : 'Sign Up'}</button>
      </form>
      <p style={{ marginTop: '10px', textAlign: 'center' }}>
        {mode === 'login' ?
          <>
            Don't have an account?
            <span style={{ color: '#1877f2', cursor: 'pointer' }} onClick={() => { setMode('register'); setError(''); }}> Register</span>
            <span style={{ margin: '0 10px' }}>|</span>
            {/* THIS IS THE NEW LINK */}
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
