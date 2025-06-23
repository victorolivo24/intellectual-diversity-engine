import React, { useState, useEffect } from 'react';

// --- STYLES ---
const styles = {
  container: {
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px'
  },
  card: {
    width: '100%', maxWidth: '800px', backgroundColor: '#fff',
    borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    padding: '30px', marginTop: '40px'
  },
  nav: { display: 'flex', gap: '15px', marginBottom: '20px' },
  navButton: { padding: '8px 16px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', background: 'none' },
  activeNavButton: { backgroundColor: '#1877f2', color: '#fff', borderColor: '#1877f2' },
  inputContainer: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: { flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { padding: '10px 20px', borderRadius: '4px', border: 'none', backgroundColor: '#1877f2', color: '#fff', cursor: 'pointer' },
  errorText: { color: '#fa383e', marginBottom: '20px' },
  sectionTitle: { fontSize: '20px', fontWeight: 'bold', marginTop: '20px', marginBottom: '10px' },
  sentimentBar: { marginBottom: '8px' },
  wordCloud: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  wordItem: { cursor: 'default' },
  historyList: { listStyle: 'none', padding: 0, margin: 0 },
  historyItem: { padding: '8px', borderBottom: '1px solid #eee' }
};

// --- Auth Component ---
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
      <p style={{ marginTop:'10px' }}>
        {mode==='login' ?
          <>Don't have an account? <span style={{ color:'#1877f2', cursor:'pointer' }} onClick={()=>{setMode('register');setError('');}}>Register</span></>
        :
          <>Have an account? <span style={{ color:'#1877f2', cursor:'pointer' }} onClick={()=>{setMode('login');setError('');}}>Login</span></>
        }
      </p>
    </div>
  );
}

// --- Analysis Component ---
function AnalysisComponent({ auth, onBack }) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const analyze = async () => {
    if (!url) return setError('Enter a URL');
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('http://127.0.0.1:5000/analyze', {
        method:'POST', headers:{'Content-Type':'application/json','x-access-token':auth.token},
        body:JSON.stringify({url})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setResult(data.data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.card}>
      <div style={styles.nav}>
        <button onClick={onBack} style={styles.navButton}>← Back</button>
      </div>
      <h2>Analyze New Article</h2>
      <div style={styles.inputContainer}>
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." style={styles.input}/>
        <button onClick={analyze} style={styles.button} disabled={loading}>{loading?'Analyzing...':'Analyze'}</button>
      </div>
      {error && <div style={styles.errorText}>{error}</div>}
      {result && (
        <div>
          <h3>Results for: {result.title}</h3>
          <div style={styles.sectionTitle}>Sentiment Score</div>
          <div style={styles.sentimentBar}>{typeof result.sentiment === 'number' ? result.sentiment.toFixed(2) : 'N/A'}</div>
          <div style={styles.sectionTitle}>Keywords</div>
          <div style={styles.wordCloud}>
            {Array.isArray(result.keywords) && result.keywords.length > 0
              ? result.keywords.map((w,i)=>(
                  <span key={i} style={{ ...styles.wordItem, fontSize:`${12 + w.length}px` }}>{w}</span>
                ))
              : <p>No keywords available.</p>
            }
          </div>

          <div style={styles.sectionTitle}>Article Text</div>
          <div style={{ maxHeight:'300px', overflowY:'auto' }}>
{result.article_text
  ? result.article_text.split('\n\n').map((p,i)=>(<p key={i}>{p}</p>))
  : <p>Full article text not available.</p>
}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dashboard Component ---
function DashboardComponent({ auth }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/dashboard',{headers:{'x-access-token':auth.token}})
      .then(res=>res.json())
      .then(arts=>setData(arts))
      .catch(e=>setError(e.message))
      .finally(()=>setLoading(false));
  }, [auth.token]);

  if (loading) return <div style={styles.card}>Loading...</div>;
  if (error) return <div style={styles.card}><div style={styles.errorText}>{error}</div></div>;

  // Sentiment counts
  const total = data.length;
  const positive = data.filter(a => a.sentiment > 0.05).length;
  const neutral = data.filter(a => Math.abs(a.sentiment) <= 0.05).length;
  const negative = data.filter(a => a.sentiment < -0.05).length;

  // Keyword frequencies
  const freq = {};
  data.forEach(a => a.keywords.forEach(w => freq[w] = (freq[w]||0)+1));
  const sortedKeywords = Object.entries(freq).sort((a,b)=>b[1]-a[1]);

  return (
    <div style={styles.card}>
      <h2 style={styles.title}>Your Information Diet</h2>
      <div style={styles.sectionTitle}>Sentiment Breakdown</div>
      <div style={styles.sentimentBar}>Positive: {positive} ({((positive/total)*100).toFixed(1)}%)</div>
      <div style={styles.sentimentBar}>Neutral: {neutral} ({((neutral/total)*100).toFixed(1)}%)</div>
      <div style={styles.sentimentBar}>Negative: {negative} ({((negative/total)*100).toFixed(1)}%)</div>

      <div style={styles.sectionTitle}>Top Keywords</div>
      <div style={styles.wordCloud}>
        {sortedKeywords.slice(0,20).map(([word,count],i)=>(
          <span key={i} style={{ ...styles.wordItem, fontSize:`${12 + count*4}px` }}>{word}</span>
        ))}
      </div>

      <div style={styles.sectionTitle}>Reading History</div>
      <ul style={styles.historyList}>
        {data.map((a,i)=>(
          <li key={i} style={styles.historyItem}>
            <strong>{a.title}</strong> — Score: {a.sentiment.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('dashboard');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const username = sessionStorage.getItem('username');
    if (token && username) setAuth({ token, username });
  }, []);

  if (!auth) return <AuthComponent onAuth={info => { sessionStorage.setItem('token', info.token); sessionStorage.setItem('username', info.username); setAuth(info); }} />;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.nav}>
          <button onClick={() => setView('dashboard')} style={{ ...styles.navButton, ...(view==='dashboard'?styles.activeNavButton:{}) }}>Dashboard</button>
          <button onClick={() => setView('analyze')} style={{ ...styles.navButton, ...(view==='analyze'?styles.activeNavButton:{}) }}>Analyze</button>
        </div>
        {view==='dashboard'
          ? <DashboardComponent auth={auth} />
          : <AnalysisComponent auth={auth} onBack={() => setView('dashboard')} />
        }
      </div>
    </div>
  );
}
