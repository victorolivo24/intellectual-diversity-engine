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
      <img
        src="/transparentlogo.png"
        alt="Out of the Loop"
        style={{ width: '60px', height: '60px', display: 'block', margin: '0 auto 10px' }}
      />
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{mode==='login' ? 'Login' : 'Register'}</h2>
      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required style={styles.input}/>
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required style={styles.input}/>
        {error && <div style={styles.errorText}>{error}</div>}
        <button type="submit" style={styles.button}>{mode==='login' ? 'Login' : 'Sign Up'}</button>
      </form>
      <div style={{ textAlign: 'center', margin: '15px 0', color: '#666', fontWeight: 'bold' }}>OR</div>
      <a href="http://127.0.0.1:5000/login/google?state=dashboard" className="google-btn">
        <div className="google-icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
            <g>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 11.22l7.97-6.22z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </g>
          </svg>
        </div>
        <p className="btn-text"><b>Sign in with Google</b></p>
      </a>
      <p style={{ marginTop: '15px', textAlign: 'center' }}>
        {mode === 'login' ?
          <>
            Don't have an account?
            <span style={{ color: '#28a745', cursor: 'pointer' }} onClick={() => { setMode('register'); setError(''); }}> Register</span>
            <span style={{ margin: '0 10px' }}>|</span>
            <a href="/reset-password" style={{ color: '#28a745', cursor: 'pointer' }}>Forgot Password?</a>
          </>
          :
          <>
            Have an account?
            <span style={{ color: '#28a745', cursor: 'pointer' }} onClick={() => { setMode('login'); setError(''); }}> Login</span>
          </>
        }
      </p>
    </div>
  );
}
