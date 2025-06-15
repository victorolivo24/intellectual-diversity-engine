import React, { useState } from 'react';

// This is our main App component
function App() {
  // 'useState' is a React Hook that lets us add state to our components.
  // 'url' will store the text from the input box.
  // 'analysisResult' will store the response from our Flask API.
  const [url, setUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // This function is called when the "Analyze" button is clicked.
  const handleAnalyze = async () => {
    // Basic check to make sure the URL is not empty
    if (!url) {
      setError('Please enter a URL to analyze.');
      return;
    }

    setIsLoading(true);
    setError('');
    setAnalysisResult(null);

    try {
      // This is the core of the frontend-backend communication.
      // We use 'fetch' to send a POST request to our Flask server's /analyze endpoint.
      const response = await fetch('http://127.0.0.1:5000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }), // We send the URL from our state in the request body
      });

      if (!response.ok) {
        // If the server responds with an error status (like 500), we throw an error.
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // We update our state with the data received from the backend.
      setAnalysisResult(data);

    } catch (e) {
      console.error("There was an error analyzing the URL:", e);
      setError('Failed to analyze the URL. Please ensure your backend server is running and the URL is correct.');
      setAnalysisResult(null);
    } finally {
      // This runs whether the request succeeded or failed.
      setIsLoading(false);
    }
  };

  // This is the JSX that defines what our component looks like.
  // It uses a simplified styling approach directly in the JSX.
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
          />
          <button onClick={handleAnalyze} style={styles.button} disabled={isLoading}>
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        {analysisResult && (
          <div style={styles.resultsContainer}>
            <h2 style={styles.resultsTitle}>Analysis Complete</h2>
            <div style={styles.resultItem}>
              <strong>Status:</strong> {analysisResult.message}
            </div>
            <div style={styles.resultItem}>
              <strong>Title:</strong> {analysisResult.data?.title || 'Not found'}
            </div>
             <div style={styles.resultItem}>
              <strong>Author:</strong> {analysisResult.data?.author || 'Not found'}
            </div>
            <div style={styles.resultItem}>
              <strong>Published:</strong> {analysisResult.data?.publish_date ? new Date(analysisResult.data.publish_date).toLocaleDateString() : 'Not found'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- STYLING ---
// This is a common way to style React components without external CSS files.
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
  },
  errorText: {
    color: '#fa383e',
    textAlign: 'center',
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
  resultItem: {
    backgroundColor: '#f7f8fa',
    padding: '15px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '16px',
    color: '#1c1e21',
  },
};


export default App;
