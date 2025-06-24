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
function AnalysisComponent({ auth, onBack, onAnalysisComplete }) {
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
      if (onAnalysisComplete) onAnalysisComplete();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{...styles.card, padding: 0, boxShadow: 'none', marginTop: 0}}>
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
                  <span key={i} style={{ padding: '5px 10px', backgroundColor: '#e4e6eb', borderRadius: '15px' }}>{w}</span>
                ))
              : <p>No keywords available.</p>
            }
          </div>
        </div>
      )}
    </div>
  );
}
// --- Dashboard Component (UPDATED with Topic Analysis and Document Frequency) ---
// In App.js

// In App.js

function DashboardComponent({ auth, onRefresh, key }) { // Added key back for consistency with your setup
  const [dashboardState, setDashboardState] = useState({ loading: true, error: null, articles: [], topicAnalysis: [] });
  const [expandedCategory, setExpandedCategory] = useState(null);

  const allCategories = ["Politics", "Technology", "Sports", "Business", "Entertainment", "Science", "Health", "World News", "Lifestyle", "Crime", "Other"];

  useEffect(() => {
    if (!auth.token) return;
    const fetchData = async () => {
      setDashboardState(s => ({ ...s, loading: true }));
      try {
        const [articlesRes, topicsRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/dashboard', { headers: { 'x-access-token': auth.token } }),
          fetch('http://127.0.0.1:5000/category_analysis', { headers: { 'x-access-token': auth.token } })
        ]);
        if (!articlesRes.ok || !topicsRes.ok) throw new Error("Could not fetch dashboard data.");
        const articles = await articlesRes.json();
        const topicAnalysis = await topicsRes.json();
        setDashboardState({ loading: false, error: null, articles: articles || [], topicAnalysis: topicAnalysis || [] });
      } catch (err) {
        setDashboardState({ loading: false, error: err.message, articles: [], topicAnalysis: [] });
      }
    };
    fetchData();
  }, [auth.token, key]); // Changed dependency back to 'key' to match App component

  const handleMoveArticle = async (articleId, newCategory) => {
    try {
      const res = await fetch('http://127.0.0.1:5000/move_article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-token': auth.token },
        body: JSON.stringify({ article_id: articleId, new_category: newCategory })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to move article');
      
      if(onRefresh) onRefresh();

    } catch (err) {
      console.error("Move article error:", err);
    }
  };

  const wordCloudData = useMemo(() => {
    if (!dashboardState.articles || dashboardState.articles.length === 0) return [];
    const docFrequency = {};
    dashboardState.articles.forEach(article => {
      const uniqueKeywords = new Set(article.keywords || []);
      uniqueKeywords.forEach(keyword => {
        docFrequency[keyword] = (docFrequency[keyword] || 0) + 1;
      });
    });
    return Object.entries(docFrequency).sort((a,b) => b[1] - a[1]);
  }, [dashboardState.articles]);

  if (dashboardState.loading) return <div>Loading...</div>;
  if (dashboardState.error) return <div style={styles.errorText}>Error: {dashboardState.error}</div>;

  return (
    <div>
      <h2 style={styles.title}>Your Information Diet</h2>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px'}}>
        <div>
          <h3 style={styles.sectionTitle}>Top Keywords</h3>
          {/* --- THIS IS THE RESTORED CODE BLOCK --- */}
          <div style={styles.wordCloud}>
            {wordCloudData.slice(0, 20).map(([word, count]) => (
              <span key={word} style={{...styles.wordItem, fontSize: `${12 + count * 4}px`, opacity: 0.5 + count * 0.1 }}>{word}</span>
            ))}
          </div>
        </div>
        <div>
          <h3 style={styles.sectionTitle}>Topic Sentiments</h3>
          <div style={{maxHeight: '300px', overflowY: 'auto'}}>
            <table style={styles.topicTable}>
              <thead>
                <tr>
                  <th style={styles.tableHeader}>Topic</th>
                  <th style={styles.tableHeader}>Articles</th>
                  <th style={styles.tableHeader}>Avg. Sentiment</th>
                  <th style={styles.tableHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboardState.topicAnalysis.map((item, i) => (
                  <React.Fragment key={i}>
                    <tr>
                      <td style={styles.tableCell}>{item.category}</td>
                      <td style={styles.tableCell}>{item.article_count}</td>
                      <td style={{...styles.tableCell, color: item.average_sentiment > 0.05 ? '#28a745' : item.average_sentiment < -0.05 ? '#dc3545' : 'inherit', fontWeight: 'bold'}}>
                        {item.average_sentiment.toFixed(2)}
                      </td>
                      <td style={styles.tableCell}>
                        <button onClick={() => setExpandedCategory(expandedCategory === item.category ? null : item.category)} style={{...styles.button, padding: '5px 10px', fontSize: '12px'}}>
                          {expandedCategory === item.category ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expandedCategory === item.category && (
                      <tr>
                        <td colSpan="4" style={{ padding: '15px', background: '#f9f9f9' }}>
                          {dashboardState.articles.filter(a => a.category === item.category).map(article => (
                            <div key={article.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                              <span style={{ flex: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '15px' }}>
                                {article.title} (Sentiment: {article.sentiment.toFixed(2)})
                              </span>
                              <select 
                                value={article.category} 
                                onChange={(e) => handleMoveArticle(article.id, e.target.value)}
                                style={{ padding: '5px', borderRadius: '4px' }}
                              >
                                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


// You also need to adjust the main App component to pass the props correctly as I had them before.
// I've simplified it back to what you had originally which works fine.
export default function App() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('dashboard');
  const [dashboardKey, setDashboardKey] = useState(0);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const username = sessionStorage.getItem('username');
    if (token && username) setAuth({ token, username });
  }, []);

  const handleAnalysisComplete = () => {
    setDashboardKey(k => k + 1);
  };

  if (!auth) return <div style={styles.container}><AuthComponent onAuth={info => { sessionStorage.setItem('token', info.token); sessionStorage.setItem('username', info.username); setAuth(info); }} /></div>;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.nav}>
          <button onClick={() => setView('dashboard')} style={{ ...styles.navButton, ...(view==='dashboard'?styles.activeNavButton:{}) }}>Dashboard</button>
          <button onClick={() => setView('analyze')} style={{ ...styles.navButton, ...(view==='analyze'?styles.activeNavButton:{}) }}>Analyze</button>
          <button onClick={() => { setAuth(null); sessionStorage.clear(); }} style={{ ...styles.navButton, marginLeft: 'auto' }}>Logout</button>
        </div>
        {view==='dashboard'
          ? <DashboardComponent auth={auth} key={dashboardKey} onRefresh={handleAnalysisComplete}/>
          : <AnalysisComponent auth={auth} onBack={() => setView('dashboard')} onAnalysisComplete={handleAnalysisComplete} />
        }
      </div>
    </div>
  );
}