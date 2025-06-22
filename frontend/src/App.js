import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- STYLING OBJECT ---
const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  card: { width: '100%', maxWidth: '900px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', padding: '40px', boxSizing: 'border-box', marginTop: '50px' },
  title: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center', color: '#1c1e21', marginBottom: '10px' },
  subtitle: { fontSize: '18px', textAlign: 'center', color: '#606770', marginBottom: '40px' },
  inputContainer: { display: 'flex', marginBottom: '20px' },
  input: { flex: 1, border: '1px solid #dddfe2', borderRadius: '6px 0 0 6px', padding: '15px', fontSize: '16px', outline: 'none' },
  button: { border: 'none', borderRadius: '0 6px 6px 0', backgroundColor: '#1877f2', color: 'white', padding: '0 25px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s' },
  errorText: { color: '#fa383e', textAlign: 'center', marginTop: '10px', height: '20px' },
  resultsTitle: { fontSize: '28px', fontWeight: 'bold', textAlign: 'center', color: '#1c1e21', marginBottom: '20px' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px,1fr))', gap: '30px' },
  chartContainer: { height: '300px', width: '100%' },
  historyList: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' },
  historyItem: { marginBottom: '10px', padding: '10px', backgroundColor: '#f7f8fa', borderRadius: '6px' },
};

// --- AuthComponent (unchanged) ---
function AuthComponent({ setAuthInfo }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setMessage('');
    const endpoint = isLogin ? '/login' : '/register';
    const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message || 'Error');
    if (isLogin) setAuthInfo({ token: data.token, username: data.username });
    else { setMessage('Registration successful! Please log in.'); setIsLogin(true); }
  };

  return (
    <div style={styles.card}>
      <h1 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>  
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit" style={styles.button}>{isLogin ? 'Log In' : 'Register'}</button>
        {error && <p style={styles.errorText}>{error}</p>}
        {message && <p style={{...styles.errorText, color: 'green'}}>{message}</p>}
      </form>
      <p style={{textAlign: 'center', cursor: 'pointer'}} onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}>
        {isLogin ? "Don't have an account? Register" : 'Have an account? Log In'}
      </p>
    </div>
  );
}

// --- AnalysisComponent (unchanged) ---
function AnalysisComponent({ authInfo }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!url) return setError('Enter a URL');
    setLoading(true); setError(''); setResult(null);
    const res = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-access-token': authInfo.token },
      body: JSON.stringify({ url })
    });
    const data = await res.json(); setLoading(false);
    if (!res.ok) return setError(data.message || 'Analysis failed');
    setResult(data.data || {});
  };

  return (
    <div>
      <h2 style={styles.subtitle}>Analyze New Article</h2>
      <div style={styles.inputContainer}>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." style={styles.input} />
        <button onClick={handleAnalyze} style={styles.button} disabled={loading}>{loading ? 'Analyzing...' : 'Analyze'}</button>
      </div>
      {error && <p style={styles.errorText}>{error}</p>}
      {result && (
        <div>
          <h3>{result.title}</h3>
          <p>{result.article_text}</p>
        </div>
      )}
    </div>
  );
}

// --- DashboardComponent ---
function DashboardComponent({ token }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true); setError(null);
    fetch('http://127.0.0.1:5000/dashboard', { headers: { 'x-access-token': token } })
      .then(res => { if (!res.ok) throw new Error('Network error'); return res.json(); })
      .then(arts => setData(arts))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={styles.errorText}>Error: {error}</p>;

  const sentimentData = [
    { name: 'Positive', value: data.filter(a => a.sentiment > 0.05).length },
    { name: 'Neutral', value: data.filter(a => Math.abs(a.sentiment) <= 0.05).length },
    { name: 'Negative', value: data.filter(a => a.sentiment < -0.05).length },
  ].filter(item => item.value > 0);

  return (
    <div style={styles.card}>
      <h2 style={styles.resultsTitle}>Your Information Diet</h2>
      <div style={styles.dashboardGrid}>
        <div>
          <h3>Sentiment Analysis</h3>
          <div style={styles.chartContainer}>
            {sentimentData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {sentimentData.map(e => <Cell key={e.name} fill={e.name === 'Positive' ? '#31a24c' : e.name === 'Negative' ? '#fa383e' : '#606770'} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p>No data.</p>}
          </div>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <h3>Reading History</h3>
          <ul style={styles.historyList}>
            {data.length ? data.map((a,i) => (
              <li key={i} style={styles.historyItem}>
                <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
              </li>
            )) : <li style={styles.historyItem}>No articles yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Main App Component ---
function App() {
  const [authInfo, setAuthInfo] = useState(null);
  const [view, setView] = useState('analyze');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const username = sessionStorage.getItem('username');
    if (token && username) setAuthInfo({ token, username });
  }, []);

  if (!authInfo) return <AuthComponent setAuthInfo={setAuthInfo} />;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={() => setView('analyze')} style={styles.button}>Analyze</button>
          <button onClick={() => setView('dashboard')} style={styles.button}>Dashboard</button>
        </div>
        {view === 'analyze' ? <AnalysisComponent authInfo={authInfo} /> : <DashboardComponent token={authInfo.token} />}
      </div>
    </div>
  );
}

export default App;
