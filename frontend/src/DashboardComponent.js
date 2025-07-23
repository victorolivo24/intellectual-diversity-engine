import React, { useState, useEffect, useMemo } from 'react';
import styles from "./styles.js";
import SentimentTimeline from './SentimentTimeline.js';


export default function DashboardComponent({ auth, setAuth, key }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    articles: [],
    topicAnalysis: [],
    sourceData: [],
    timelineData: [],
  });

  const [expandedCategory, setExpandedCategory] = useState(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");

  const [allCategories, setAllCategories] = useState([
    "Politics", "Technology", "Sports", "Business",
    "Entertainment", "Science", "Health", "World News",
    "Lifestyle", "Crime", "Other"
  ]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/topics`, {
          headers: { 'x-access-token': auth.token }
        });
        const data = await res.json();
        setAllCategories([...data.default_topics, ...data.custom_topics]);
      } catch (err) {
        console.error("Error fetching topics", err);
      }
    };
    fetchTopics();
  }, [auth.token]);
  const fetchData = async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const [articlesRes, topicsRes, sourcesRes, timelineRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/dashboard`, { headers: { 'x-access-token': auth.token } }),
        fetch(`${process.env.REACT_APP_API_URL}/category_analysis`, { headers: { 'x-access-token': auth.token } }),
        fetch(`${ process.env.REACT_APP_API_URL} / source_analysis`, { headers: { 'x-access-token': auth.token } }),
        fetch(`${process.env.REACT_APP_API_URL}/sentiment_timeline`, { headers: { 'x-access-token': auth.token } })
      ]);
      if (!articlesRes.ok || !topicsRes.ok || !sourcesRes.ok || !timelineRes.ok)
        throw new Error("Could not fetch all dashboard data.");

      const articles = await articlesRes.json();
      const topicAnalysis = await topicsRes.json();
      const sourceData = await sourcesRes.json();
      const timelineData = await timelineRes.json();

      setState({ loading: false, error: null, articles, topicAnalysis, sourceData, timelineData });
    } catch (err) {
      setState({ loading: false, error: err.message, articles: [], topicAnalysis: [], sourceData: [], timelineData: [] });
    }
  };

  useEffect(() => {
    if (!auth.token) return;
    
    fetchData();
  }, [auth.token, key]);

  const handleMoveArticle = async (articleId, newCategory) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/move_article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': auth.token
        },
        body: JSON.stringify({ article_id: articleId, new_category: newCategory })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to move article.');
      }

      await fetchData();  // ✅ this now guarantees UI is up-to-date

    } catch (err) {
      console.error("Move article error:", err);
    }
  };

  const handleDeleteAccount = async () => {
    // Confirm before deleting account
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/account/delete`, {
        method: 'DELETE',
        headers: { 'x-access-token': auth.token }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete account.");
      }

      alert("Your account has been successfully deleted.");
      // Log the user out completely by clearing session and auth state
      sessionStorage.clear();
      setAuth(null); 

    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };
  const wordCloudData = useMemo(() => {
    if (!state.articles || state.articles.length === 0) return [];
    const docFrequency = {};
    state.articles.forEach(article => {
      const uniqueKeywords = new Set(article.keywords || []);
      uniqueKeywords.forEach(keyword => {
        docFrequency[keyword] = (docFrequency[keyword] || 0) + 1;
      });
    });
    return Object.entries(docFrequency).sort((a, b) => b[1] - a[1]);
  }, [state.articles]);

  if (state.loading) return <div>Loading...</div>;
  if (state.error) return <div style={styles.errorText}>Error: {state.error}</div>;

  return (
    <div>
      <div style={{ ...styles.header, justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <p style={{ ...styles.welcomeMessage, margin: 0 }}>Welcome, {auth.email}!</p>
        <button onClick={handleDeleteAccount} className="btn btn-danger btn-sm">
          Delete Account
        </button>
      </div>
      <h2 style={{ ...styles.sectionTitle, textAlign: 'center', marginBottom: '30px', fontSize: '24px' }}>
        Your Information Diet
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Topic Sentiments</h3>
        <button
          onClick={() => setShowTopicModal(true)}
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            padding: '5px 10px',
            cursor: 'pointer'
          }}>
          + Add Topic
        </button>
      </div>

      {showTopicModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1a1a1a',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '300px',
            textAlign: 'center'
          }}>
            <h4 style={{ marginBottom: '10px' }}>Create New Topic</h4>
            <input
              placeholder="Topic name"
              value={newTopicName}
              onChange={e => setNewTopicName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '10px',
                border: '1px solid #555',
                borderRadius: '4px',
                background: '#333',
                color: 'white'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`${process.env.REACT_APP_API_URL}/topics`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-access-token': auth.token },
                      body: JSON.stringify({ name: newTopicName })
                    });

                    if (!res.ok) throw new Error(await res.json().then(e => e.message));

                    // ✅ Re-fetch updated topics list
                    const topicsRes = await fetch(`${process.env.REACT_APP_API_URL}/topics`, {
                      headers: { 'x-access-token': auth.token }
                    });
                    const topicsData = await topicsRes.json();
                    setAllCategories([...topicsData.default_topics, ...topicsData.custom_topics]);

                    // ✅ Also refresh full dashboard data
                    await fetchData();

                    setShowTopicModal(false);
                    setNewTopicName('');
                    alert("✅ Topic created successfully!");
                  } catch (err) {
                    alert(err.message);
                  }
                }}

                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setShowTopicModal(false)}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '5px 10px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        <table className="table table-dark table-bordered align-middle" style={styles.topicTable}>
          <thead>
            <tr>
              <th style={styles.tableHeader} className="text-start">Topic</th>
              <th style={styles.tableHeader}>Articles</th>
              <th style={styles.tableHeader}>Avg. Score</th>
              <th style={styles.tableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {state.topicAnalysis.map((item, i) => (
              <React.Fragment key={i}>
                <tr>
                  <td style={{ ...styles.tableCell, verticalAlign: 'middle' }}>{item.category}</td>
                  <td style={{ ...styles.tableCell, verticalAlign: 'middle' }}>{item.article_count}</td>
                  <td style={{
                    ...styles.tableCell,
                    verticalAlign: 'middle',
                    color: item.average_sentiment > 0.05 ? '#28a745' :
                      item.average_sentiment < -0.05 ? '#dc3545' : 'inherit',
                    fontWeight: 'bold'
                  }}>{item.average_sentiment.toFixed(2)}</td>
                  <td style={{ ...styles.tableCell, verticalAlign: 'middle' }}>
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === item.category ? null : item.category)}
                      style={{ ...styles.button, padding: '5px 10px', fontSize: '12px' }}
                    >
                      {expandedCategory === item.category ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
                {expandedCategory === item.category && (
                  <tr>
                    <td colSpan="4" style={{
                      padding: '15px',
                      background: '#1f1f1f',
                      color: '#f1f1f1'
                    }}>
                      {state.articles.filter(a => a.category === item.category).map(article => (
                        <div
                          key={article.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: '1px solid #333'
                          }}>
                          <span
                            title={article.title}
                            style={{
                              flex: '1',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginRight: '15px',
                              color: '#f1f1f1'
                            }}>
                            {article.title} (<span style={{
                              color: article.sentiment > 0.05 ? '#28a745' :
                                article.sentiment < -0.05 ? '#dc3545' : '#f1f1f1'
                            }}>Score: {article.sentiment.toFixed(2)}</span>)
                          </span>
                          <select
                            value={article.category}
                            onChange={e => handleMoveArticle(article.id, e.target.value)}
                            style={{
                              padding: '5px',
                              borderRadius: '4px',
                              border: '1px solid #444',
                              background: '#222',
                              color: '#f1f1f1'
                            }}>
                            {allCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', marginTop: '30px' }}>
        <div style={{ ...styles.card, padding: '20px' }}>
          <h3 style={styles.sectionTitle}>Top Keywords</h3>
          <div style={styles.wordCloud}>
            {wordCloudData.slice(0, 15).map(([word, count]) => (
              <span
                key={word}
                style={{
                  ...styles.wordItem,
                  fontSize: `${12 + count * 4}px`,
                  opacity: 0.6,
                  color: '#f1f1f1'
                }}>
                {word}
              </span>
            ))}
          </div>
        </div>
        <div style={{ ...styles.card, padding: '20px' }}>
          <h3 style={styles.sectionTitle}>Sentiment Timeline</h3>
          {/* We pass the timelineData from this component's state down as a prop */}
          <SentimentTimeline data={state.timelineData} />
        </div>
    </div>
    </div>
  );
}