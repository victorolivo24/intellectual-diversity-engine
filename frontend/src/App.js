import React, { useState, useEffect, useMemo } from 'react';

// --- STYLES ---
const styles = {
  container: {
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  },
  card: {
    width: '100%', maxWidth: '900px', backgroundColor: '#fff',
    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    padding: '40px', marginTop: '50px'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  welcomeMessage: { fontSize: '16px', color: '#606770' },
  logoutButton: { border: 'none', background: 'transparent', color: '#1877f2', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  nav: { display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #dddfe2' },
  navButton: { padding: '10px 20px', cursor: 'pointer', border: 'none', borderBottom: '3px solid transparent', background: 'none', fontWeight: 'bold', color: '#606770' },
  activeNavButton: { color: '#1877f2', borderBottom: '3px solid #1877f2' },
  inputContainer: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#1877f2', color: '#fff', cursor: 'pointer' },
  errorText: { color: '#fa383e', marginBottom: '20px', textAlign: 'center' },
  sectionTitle: { fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '15px' },
  wordCloud: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', padding: '10px' },
  wordItem: { cursor: 'default', padding: '5px' },
  historyList: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '8px' },
  historyItem: { padding: '15px', borderBottom: '1px solid #eee' },
  topicTable: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { borderBottom: '2px solid #333', textAlign: 'left', padding: '12px' },
  tableCell: { borderBottom: '1px solid #eee', padding: '12px' },
};

// --- Auth Component (from your working code) ---
function AuthComponent({ onAuth }) {
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
      <p style={{ marginTop:'10px', textAlign: 'center' }}>
        {mode==='login' ?
          <>Don't have an account? <span style={{ color:'#1877f2', cursor:'pointer' }} onClick={()=>{setMode('register');setError('');}}>Register</span></>
        :
          <>Have an account? <span style={{ color:'#1877f2', cursor:'pointer' }} onClick={()=>{setMode('login');setError('');}}>Login</span></>
        }
      </p>
    </div>
  );
}

// --- Analysis Component (from your working code, with onAnalysisComplete added) ---
// In App.js

