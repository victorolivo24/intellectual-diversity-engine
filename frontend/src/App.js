import React, { useState } from 'react';

// --- Helper Components ---

// A new component to visualize the sentiment score
const SentimentIndicator = ({ score }) => {
  let color = '#606770'; // Neutral color
  let text = 'Neutral';

  if (score > 0.05) {
    color = '#31a24c'; // Positive color (green)
    text = 'Positive';
  } else if (score < -0.05) {
    color = '#fa383e'; // Negative color (red)
    text = 'Negative';
  }

  const scorePercentage = ((score + 1) / 2) * 100;

  return (
    <div>
      <strong>Sentiment:</strong>
      <div style={{...styles.sentimentBar, backgroundColor: color}}>
        {text} ({score.toFixed(2)})
      </div>
    </div>
  );
};

// A new component to display keywords as styled tags
const KeywordTags = ({ keywords }) => {
  return (
    <div>
      <strong>Keywords:</strong>
      <div style={styles.keywordContainer}>
        {keywords.map((keyword, index) => (
          <span key={index} style={styles.keywordTag}>{keyword}</span>
        ))}
      </div>
    </div>
  );
};


// --- Main App Component ---
function App() {
  const [url, setUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    if (!url) {
      setError('Please enter a URL to analyze.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      const response = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      setAnalysisResult(data);

    } catch (e) {
      console.error("Analysis error:", e);
      setError(e.message || 'An unexpected error occurred.');
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Echo Escape</h1>
        <p style={styles.subtitle}>
          Paste an article URL to analyze its content and begin your journey out of the echo chamber.
        </p>
        
        <div style={styles.inputContainer}>
          <input
            type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/article..." style={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <button onClick={handleAnalyze} style={styles.button} disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        {analysisResult && analysisResult.data && (
          <div style={styles.resultsContainer}>
            <div style={styles.metadataGrid}>
              <div style={styles.resultItem}>
                <strong>Title:</strong> {analysisResult.data.title || 'N/A'}
              </div>
              <div style={styles.resultItem}>
                <strong>Author:</strong> {analysisResult.data.author || 'N/A'}
              </div>
              <div style={styles.resultItem}>
                <SentimentIndicator score={analysisResult.data.sentiment} />
              </div>
              <div style={styles.resultItem}>
                <KeywordTags keywords={analysisResult.data.keywords} />
              </div>
            </div>
            
            <div style={styles.articleTextContainer}>
              <h3 style={styles.articleTitle}>Article Text</h3>
              <div style={styles.articleText}>
                {analysisResult.data.article_text ? 
                  analysisResult.data.article_text.split('\n\n').map((p, i) => <p key={i} style={{marginBottom: '1em'}}>{p}</p>) 
                  : "No text extracted."}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLING (updated) ---
const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  card: { width: '100%', maxWidth: '900px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)', padding: '40px', boxSizing: 'border-box', marginTop: '50px' },
  title: { fontSize: '36px', fontWeight: 'bold', textAlign: 'center', color: '#1c1e21', marginBottom: '10px' },
  subtitle: { fontSize: '18px', textAlign: 'center', color: '#606770', marginBottom: '40px' },
  inputContainer: { display: 'flex', marginBottom: '20px' },
  input: { flex: 1, border: '1px solid #dddfe2', borderRadius: '6px 0 0 6px', padding: '15px', fontSize: '16px', outline: 'none' },
  button: { border: 'none', borderRadius: '0 6px 6px 0', backgroundColor: '#1877f2', color: 'white', padding: '0 25px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s' },
  errorText: { color: '#fa383e', textAlign: 'center', marginTop: '10px' },
  resultsContainer: { marginTop: '40px', borderTop: '1px solid #dddfe2', paddingTop: '30px' },
  metadataGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginBottom: '30px' },
  resultItem: { backgroundColor: '#f7f8fa', padding: '15px', borderRadius: '8px', fontSize: '14px', color: '#1c1e21', lineHeight: 1.5 },
  sentimentBar: { borderRadius: '4px', padding: '8px 12px', color: 'white', fontWeight: 'bold', textAlign: 'center', marginTop: '8px', fontSize: '14px' },
  keywordContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' },
  keywordTag: { backgroundColor: '#e4e6eb', color: '#333', padding: '5px 10px', borderRadius: '15px', fontSize: '13px' },
  articleTextContainer: { marginTop: '20px' },
  articleTitle: { fontSize: '20px', color: '#1c1e21', marginBottom: '15px', borderBottom: '1px solid #dddfe2', paddingBottom: '10px' },
  articleText: { backgroundColor: '#f7f8fa', padding: '20px', borderRadius: '8px', fontSize: '16px', lineHeight: '1.6', color: '#1c1e21', maxHeight: '400px', overflowY: 'auto' },
};

export default App;