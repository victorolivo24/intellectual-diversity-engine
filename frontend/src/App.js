import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- STYLING OBJECT ---
const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  card: { width: '100%', maxWidth: '900px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)', padding: '40px', boxSizing: 'border-box', marginTop: '50px' },
  title: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center', color: '#1c1e21', marginBottom: '10px' },
  subtitle: { fontSize: '18px', textAlign: 'center', color: '#606770', marginBottom: '40px' },
  inputContainer: { display: 'flex', marginBottom: '20px' },
  input: { flex: 1, border: '1px solid #dddfe2', borderRadius: '6px 0 0 6px', padding: '15px', fontSize: '16px', outline: 'none' },
  button: { border: 'none', borderRadius: '0 6px 6px 0', backgroundColor: '#1877f2', color: 'white', padding: '0 25px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s' },
  errorText: { color: '#fa383e', textAlign: 'center', marginTop: '10px', height: '20px' },
  resultsContainer: { marginTop: '40px', borderTop: '1px solid #dddfe2', paddingTop: '30px' },
  metadataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginBottom: '30px' },
  resultItem: { backgroundColor: '#f7f8fa', padding: '15px', borderRadius: '8px', fontSize: '14px', color: '#1c1e21', lineHeight: 1.5, overflow: 'hidden' },
  sentimentBar: { borderRadius: '4px', padding: '8px 12px', color: 'white', fontWeight: 'bold', textAlign: 'center', marginTop: '8px', fontSize: '14px' },
  keywordContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  keywordTag: { backgroundColor: '#e4e6eb', color: '#333', padding: '5px 10px', borderRadius: '15px', fontSize: '13px' },
  articleTextContainer: { marginTop: '20px' },
  articleTitle: { fontSize: '20px', color: '#1c1e21', marginBottom: '15px', borderBottom: '1px solid #dddfe2', paddingBottom: '10px' },
  articleText: { backgroundColor: '#f7f8fa', padding: '20px', borderRadius: '8px', fontSize: '16px', lineHeight: '1.6', color: '#1c1e21', maxHeight: '400px', overflowY: 'auto' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', margin: '40px auto' },
  authInput: { border: '1px solid #dddfe2', borderRadius: '6px', padding: '15px', fontSize: '16px', outline: 'none' },
  authButton: { border: 'none', borderRadius: '6px', backgroundColor: '#31a24c', color: 'white', padding: '15px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  authToggle: { color: '#1877f2', textAlign: 'center', cursor: 'pointer', marginTop: '10px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  welcomeMessage: { fontSize: '16px', color: '#606770' },
  logoutButton: { border: 'none', background: 'transparent', color: '#1877f2', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' },
  viewTabs: { display: 'flex', gap: '10px', borderBottom: '1px solid #dddfe2', marginBottom: '30px' },
  tab: { padding: '10px 20px', cursor: 'pointer', borderBottom: '3px solid transparent', color: '#606770', fontWeight: 'bold' },
  activeTab: { color: '#1877f2', borderBottom: '3px solid #1877f2' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'flex-start' },
  chartContainer: { height: '300px', width: '100%' },
  historyList: { listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' },
  historyItem: { marginBottom: '10px', padding: '10px', backgroundColor: '#f7f8fa', borderRadius: '6px' },
};

// --- Child Components ---

const AuthComponent = ({ setAuthInfo }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    const endpoint = isLogin ? '/login' : '/register';
    const body = JSON.stringify({ username, password });
    try {
        const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body,
        });
        const data = await response.json();
        if (!response.ok) { throw new Error(data.message || "An error occurred."); }
        if(isLogin) {
            setAuthInfo({ token: data.token, username: data.username });
        } else {
            setMessage('Registration successful! Please Log In.'); setIsLogin(true);
        }
    } catch (err) { setError(err.message); }
  };

  return (
    <div style={styles.card}>
        <h1 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h1>
        <form onSubmit={handleSubmit} style={styles.authForm}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.authInput} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.authInput} required />
            <button type="submit" style={styles.authButton}>{isLogin ? 'Log In' : 'Register'}</button>
            <div style={{height: '20px', textAlign: 'center'}}>
              {error && <p style={styles.errorText}>{error}</p>}
              {message && <p style={{...styles.errorText, color: 'green'}}>{message}</p>}
            </div>
        </form>
        <p onClick={() => {setIsLogin(!isLogin); setError(''); setMessage('');}} style={styles.authToggle}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Log In"}
        </p>
    </div>
  );
};

const AnalysisComponent = ({ authInfo }) => {
    const [url, setUrl] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAnalyze = async () => {
        if (!url) { setError('Please enter a URL.'); return; }
        setIsLoading(true); setError(''); setAnalysisResult(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': authInfo.token },
                body: JSON.stringify({ url }),
            });
            const data = await response.json();
            if (!response.ok || data.status === 'error') throw new Error(data.message || 'Analysis failed');
            setAnalysisResult(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <p style={{...styles.subtitle, textAlign: 'left', margin: '10px 0 30px 0', fontSize: '16px'}}>Paste an article URL to add it to your reading history.</p>
            <div style={styles.inputContainer}>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={styles.input} onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()} />
              <button onClick={handleAnalyze} style={styles.button} disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Analyze'}</button>
            </div>
            <div style={{height: '20px'}}>{error && <p style={styles.errorText}>{error}</p>}</div>
            {analysisResult && analysisResult.data && (
                <div style={styles.resultsContainer}>
                  <div style={styles.metadataGrid}>
                      <div style={styles.resultItem}><strong>Title:</strong> {analysisResult.data.title || 'N/A'}</div>
                      <div style={styles.resultItem}><strong>Author:</strong> {analysisResult.data.author || 'N/A'}</div>
                      <div style={styles.resultItem}><SentimentIndicator score={analysisResult.data.sentiment || 0} /></div>
                      <div style={styles.resultItem}><KeywordTags keywords={analysisResult.data.keywords || []} /></div>
                  </div>
                  <div style={styles.articleTextContainer}>
                      <h3 style={styles.articleTitle}>Article Text</h3>
                      <div style={styles.articleText}>{analysisResult.data.article_text ? analysisResult.data.article_text.split('\n\n').map((p, i) => <p key={i} style={{marginBottom: '1em'}}>{p}</p>) : "No text extracted."}</div>
                  </div>
                </div>
            )}
        </div>
    );
};

const DashboardComponent = ({ authInfo }) => {
  const [dashboardData, setDashboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/dashboard', {
          headers: { 'x-access-token': authInfo.token }
        });
        const data = await response.json();
        if (!response.ok || data.status === 'error') {
          throw new Error(data.message || "Could not fetch dashboard data.");
        }
        setDashboardData(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [authInfo.token]);

  if (loading) return <p>Loading dashboard...</p>;
  if (error) return <p style={styles.errorText}>{error}</p>;

  const sentimentData = [
    { name: 'Positive', value: dashboardData.filter(a => a.sentiment > 0.05).length },
    { name: 'Negative', value: dashboardData.filter(a => a.sentiment < -0.05).length },
    { name: 'Neutral', value: dashboardData.filter(a => a.sentiment >= -0.05 && a.sentiment <= 0.05).length }
  ].filter(item => item.value > 0); 

  // --- THIS IS THE FIX ---
  // A color map to ensure the correct color is always used for each category.
  const SENTIMENT_COLORS = {
    Positive: '#31a24c',
    Negative: '#fa383e',
    Neutral: '#606770',
  };
  // -----------------------
  
  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    if (percent === 0) return null; // Don't render label for 0%
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontWeight="bold">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
  };


  return (
    <div>
        <h2 style={styles.resultsTitle}>Your Information Diet</h2>
        <div style={styles.dashboardGrid}>
            <div>
                <h3 style={styles.articleTitle}>Sentiment Analysis</h3>
                <div style={styles.chartContainer}>
                    {dashboardData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={sentimentData} cx="50%" cy="50%" labelLine={false} label={renderCustomizedLabel} outerRadius={100} fill="#8884d8" dataKey="value">
                                    {sentimentData.map((entry, index) => (
                                        // Use the color map to get the correct color by name
                                        <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.name]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p>Analyze an article to see your sentiment breakdown.</p>}
                </div>
            </div>
            <div>
                <h3 style={styles.articleTitle}>Reading History</h3>
                <ul style={styles.historyList}>
                    {dashboardData.length > 0 ? dashboardData.map((article, index) => (
                        <li key={index} style={styles.historyItem}>
                           <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
                        </li>
                    )) : <p>No articles analyzed yet.</p>}
                </ul>
            </div>
        </div>
    </div>
  );
};


const SentimentIndicator = ({ score }) => {
    let color = '#606770', text = 'Neutral';
    if (score > 0.05) { color = '#31a24c'; text = 'Positive'; }
    else if (score < -0.05) { color = '#fa383e'; text = 'Negative'; }
    return (<div><strong>Sentiment:</strong><div style={{...styles.sentimentBar, backgroundColor: color}}>{text} ({score.toFixed(2)})</div></div>);
};

const KeywordTags = ({ keywords }) => (
    <div><strong>Keywords:</strong><div style={styles.keywordContainer}>{keywords.map((kw, i) => <span key={i} style={styles.keywordTag}>{kw}</span>)}</div></div>
);

// --- Main App Component ---
function App() {
  const [authInfo, setAuthInfo] = useState(null);
  const [currentView, setCurrentView] = useState('analyze');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    const username = sessionStorage.getItem('username');
    if (token && username) {
      setAuthInfo({ token, username });
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    setAuthInfo(null);
  };

  const handleLogin = (info) => {
    sessionStorage.setItem('token', info.token);
    sessionStorage.setItem('username', info.username);
    setAuthInfo(info);
  };

  const MainView = () => (
    <div style={styles.card}>
        <div style={styles.header}>
            <p style={styles.welcomeMessage}>Welcome, <strong>{authInfo.username}</strong>!</p>
            <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
        <div style={styles.viewTabs}>
            <div onClick={() => setCurrentView('analyze')} style={{...styles.tab, ...(currentView === 'analyze' && styles.activeTab)}}>Analyze New Article</div>
            <div onClick={() => setCurrentView('dashboard')} style={{...styles.tab, ...(currentView === 'dashboard' && styles.activeTab)}}>Dashboard</div>
        </div>
        {currentView === 'analyze' ? <AnalysisComponent authInfo={authInfo} /> : <DashboardComponent authInfo={authInfo} />}
    </div>
  );

  return (
    <div style={styles.container}>
      {!authInfo ? (
        <AuthComponent setAuthInfo={handleLogin} />
      ) : (
        <MainView />
      )}
    </div>
  );
}

export default App;
