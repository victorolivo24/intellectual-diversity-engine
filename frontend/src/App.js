import React, { useState, useEffect } from 'react';

// --- STYLING OBJECT (consolidated for clarity) ---
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
  resultItem: { backgroundColor: '#f7f8fa', padding: '15px', borderRadius: '8px', fontSize: '14px', color: '#1c1e21', lineHeight: 1.5 },
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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  logoutButton: { border: 'none', background: 'transparent', color: '#1877f2', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }
};

// --- Child Components ---

const AuthComponent = ({ setToken }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/login' : '/register';
    // For now, we'll just implement register. Login will come next.
    if (!isLogin) {
        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (data.status === 'error') {
                setError(data.message);
            } else {
                alert('Registration successful! Please log in.');
                setIsLogin(true); // Switch to login form
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        }
    } else {
        // We will implement the actual login logic later
        alert('Login functionality is not yet implemented. Please register a new user.');
    }
  };

  return (
    <div style={styles.card}>
        <h1 style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Your Account'}</h1>
        <form onSubmit={handleSubmit} style={styles.authForm}>
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} style={styles.authInput} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.authInput} required />
            <button type="submit" style={styles.authButton}>{isLogin ? 'Log In' : 'Register'}</button>
            {error && <p style={styles.errorText}>{error}</p>}
        </form>
        <p onClick={() => setIsLogin(!isLogin)} style={styles.authToggle}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Log In"}
        </p>
    </div>
  );
};

const AnalysisComponent = ({ token, handleLogout }) => {
    // All of our previous App component logic is now in here
    const [url, setUrl] = useState('');
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAnalyze = async () => { /* ... analyze logic from previous step ... */ };
    const getWordCount = (text) => text ? text.trim().split(/\s+/).length : 0;
    
    // Paste the full handleAnalyze function here from the previous step
    const fullHandleAnalyze = async () => {
        if (!url) { setError('Please enter a URL.'); return; }
        setIsLoading(true); setError(''); setAnalysisResult(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/analyze', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, token }), // We'll add the token later
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
        <div style={styles.card}>
            <div style={styles.header}>
                <h1 style={{...styles.title, textAlign: 'left', margin: 0}}>Echo Escape</h1>
                <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
            </div>
            <p style={{...styles.subtitle, textAlign: 'left', margin: '0 0 30px 0'}}>
              Paste an article URL to add it to your reading history.
            </p>
            <div style={styles.inputContainer}>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." style={styles.input} onKeyPress={(e) => e.key === 'Enter' && fullHandleAnalyze()} />
              <button onClick={fullHandleAnalyze} style={styles.button} disabled={isLoading}>{isLoading ? 'Analyzing...' : 'Analyze'}</button>
            </div>
            {error && <p style={styles.errorText}>{error}</p>}
            {analysisResult && analysisResult.data && (
                <div style={styles.resultsContainer}>
                    {/* ... The full result display JSX from the previous step goes here ... */}
                </div>
            )}
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
  const [token, setToken] = useState(null);

  const handleLogout = () => {
    setToken(null);
  };

  return (
    <div style={styles.container}>
      {!token ? (
        <AuthComponent setToken={setToken} />
      ) : (
        <AnalysisComponent token={token} handleLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
