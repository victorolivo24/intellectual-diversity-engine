import React, { useState } from 'react';

// This is our main App component
function App() {
  const [url, setUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // This function is called when the "Analyze" button is clicked.
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data);

    } catch (e) {
      console.error("There was an error analyzing the URL:", e);
      setError(e.message || 'Failed to analyze the URL. Please ensure your backend server is running and the URL is correct.');
      setAnalysisResult(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // A helper function to calculate word count
  const getWordCount = (text) => {
    if (!text) return 0;
    // This splits the text by any whitespace and counts the elements.
    return text.trim().split(/\s+/).length;
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Echo Escape</h1>
        <p style={styles.subtitle}>
          Paste an article URL below to analyze its content and begin your journey out of the echo chamber.
        </p>
        
        <div style={styles.inputContainer}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.example.com/article..."
            style={styles.input}
            onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <button onClick={handleAnalyze} style={styles.button} disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        {analysisResult && analysisResult.data && (
          <div style={styles.resultsContainer}>
            <h2 style={styles.resultsTitle}>Analysis Complete</h2>
            <div style={styles.metadataGrid}>
                <div style={styles.resultItem}>
                  <strong>Title:</strong> {analysisResult.data.title || 'Not found'}
                </div>
                <div style={styles.resultItem}>
                  <strong>Author:</strong> {analysisResult.data.author || 'Not found'}
                </div>
                <div style={styles.resultItem}>
                  <strong>Published:</strong> {analysisResult.data.publish_date ? new Date(analysisResult.data.publish_date).toLocaleDateString() : 'Not found'}
                </div>
                {/* --- NEW: Word Count Display --- */}
                <div style={styles.resultItem}>
                    <strong>Word Count:</strong> {getWordCount(analysisResult.data.article_text)}
                </div>
            </div>
            
            {/* --- NEW: Article Text Display --- */}
            <div style={styles.articleTextContainer}>
                <h3 style={styles.articleTitle}>Article Text</h3>
                <div style={styles.articleText}>
                    {analysisResult.data.article_text ? 
                        analysisResult.data.article_text.split('\n\n').map((paragraph, index) => (
                            <p key={index} style={{marginBottom: '1em'}}>{paragraph}</p>
                        )) : "No text extracted."}
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLING ---
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    backgroundColor: '#f0f2f5',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    padding: '40px',
    boxSizing: 'border-box',
    marginTop: '50px',
  },
  title: {
    fontSize: '36px',
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1c1e21',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '18px',
    textAlign: 'center',
    color: '#606770',
    marginBottom: '40px',
  },
  inputContainer: {
    display: 'flex',
    marginBottom: '20px',
  },
  input: {
    flex: 1,
    border: '1px solid #dddfe2',
    borderRadius: '6px 0 0 6px',
    padding: '15px',
    fontSize: '16px',
    outline: 'none',
  },
  button: {
    border: 'none',
    borderRadius: '0 6px 6px 0',
    backgroundColor: '#1877f2',
    color: 'white',
    padding: '0 25px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
  errorText: {
    color: '#fa383e',
    textAlign: 'center',
    marginTop: '10px',
  },
  resultsContainer: {
    marginTop: '40px',
    borderTop: '1px solid #dddfe2',
    paddingTop: '30px',
  },
  resultsTitle: {
    fontSize: '24px',
    color: '#1c1e21',
    marginBottom: '20px',
  },
  metadataGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
      marginBottom: '30px'
  },
  resultItem: {
    backgroundColor: '#f7f8fa',
    padding: '15px',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#1c1e21',
    lineHeight: 1.4,
  },
  articleTextContainer: {
    marginTop: '20px',
  },
  articleTitle: {
    fontSize: '20px',
    color: '#1c1e21',
    marginBottom: '15px',
    borderBottom: '1px solid #dddfe2',
    paddingBottom: '10px'
  },
  articleText: {
    backgroundColor: '#f7f8fa',
    padding: '20px',
    borderRadius: '6px',
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#1c1e21',
    maxHeight: '400px',
    overflowY: 'auto',
  }
};


export default App;
