import React, { useState } from 'react';
import styles from './styles.js'; 

export default function AnalysisComponent({ auth, onBack, onAnalysisComplete }) {
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