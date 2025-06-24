import React, { useState, useEffect, useMemo } from 'react'; 
 import styles from "./styles.js";
 
 export default function DashboardComponent({ auth, onRefresh, key }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    articles: [],
    topicAnalysis: [],
    sourceData: [],
    timelineData: [],
  });
  const [expandedCategory, setExpandedCategory] = useState(null);

  const allCategories = ["Politics", "Technology", "Sports", "Business", "Entertainment", "Science", "Health", "World News", "Lifestyle", "Crime", "Other"];

  useEffect(() => {
    if (!auth.token) return;
    const fetchData = async () => {
      setState(s => ({ ...s, loading: true }));
      try {
        const [articlesRes, topicsRes, sourcesRes, timelineRes] = await Promise.all([
          fetch('http://127.0.0.1:5000/dashboard', { headers: { 'x-access-token': auth.token } }),
          fetch('http://127.0.0.1:5000/category_analysis', { headers: { 'x-access-token': auth.token } }),
          fetch('http://127.0.0.1:5000/source_analysis', { headers: { 'x-access-token': auth.token } }),
          fetch('http://127.0.0.1:5000/sentiment_timeline', { headers: { 'x-access-token': auth.token } })
        ]);

        if (!articlesRes.ok || !topicsRes.ok || !sourcesRes.ok || !timelineRes.ok) {
            throw new Error("Could not fetch all dashboard data.");
        }

        const articles = await articlesRes.json();
        const topicAnalysis = await topicsRes.json();
        const sourceData = await sourcesRes.json();
        const timelineData = await timelineRes.json();

        setState({ loading: false, error: null, articles, topicAnalysis, sourceData, timelineData });

      } catch (err) {
        setState({ loading: false, error: err.message, articles: [], topicAnalysis: [], sourceData: [], timelineData: [] });
      }
    };
    fetchData();
  }, [auth.token, key]);

  const handleMoveArticle = async (articleId, newCategory) => {
    try {
      const res = await fetch('http://127.0.0.1:5000/move_article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-token': auth.token },
        body: JSON.stringify({ article_id: articleId, new_category: newCategory })
      });
      if (!res.ok) throw new Error(await res.json().then(e => e.message));
      if(onRefresh) onRefresh();
    } catch (err) {
      console.error("Move article error:", err);
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
    return Object.entries(docFrequency).sort((a,b) => b[1] - a[1]);
  }, [state.articles]);

  if (state.loading) return <div>Loading...</div>;
  if (state.error) return <div style={styles.errorText}>Error: {state.error}</div>;

  return (
    <div>
      <h2 style={{...styles.sectionTitle, textAlign: 'center', marginBottom: '30px', fontSize: '24px' }}>Your Information Diet</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px', marginBottom: '30px' }}>
        <div style={{...styles.card, padding: '20px', margin: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
          <h3 style={styles.sectionTitle}>Top Keywords</h3>
          <div style={styles.wordCloud}>{wordCloudData.slice(0,15).map(([word,count])=>(<span key={word} style={{...styles.wordItem,fontSize:`${12+count*4}px`,opacity:0.5+count*0.1}}>{word}</span>))}</div>
        </div>
        <div style={{...styles.card, padding: '20px', margin: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
          <h3 style={styles.sectionTitle}>Topic Sentiments</h3>
          <div style={{maxHeight: '300px', overflowY: 'auto'}}>
            <table style={styles.topicTable}>
              <thead><tr><th style={styles.tableHeader}>Topic</th><th style={styles.tableHeader}>Articles</th><th style={styles.tableHeader}>Avg. Sent.</th><th style={styles.tableHeader}>Actions</th></tr></thead>
              <tbody>
                {state.topicAnalysis.map((item, i) => (
                  <React.Fragment key={i}>
                    <tr>
                      <td style={styles.tableCell}>{item.category}</td>
                      <td style={styles.tableCell}>{item.article_count}</td>
                      <td style={{...styles.tableCell, color: item.average_sentiment > 0.05 ? '#28a745' : item.average_sentiment < -0.05 ? '#dc3545' : 'inherit', fontWeight: 'bold'}}>{item.average_sentiment.toFixed(2)}</td>
                      <td style={styles.tableCell}><button onClick={()=>setExpandedCategory(expandedCategory===item.category?null:item.category)} style={{...styles.button,padding:'5px 10px',fontSize:'12px'}}>{expandedCategory===item.category?'Hide':'View'}</button></td>
                    </tr>
                    {expandedCategory === item.category && (
                      <tr>
                        <td colSpan="4" style={{ padding: '15px', background: '#f9f9f9' }}>
                          {state.articles.filter(a => a.category === item.category).map(article => (
                            <div key={article.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                              <span title={article.title} style={{ flex: '1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '15px' }}>{article.title} (Sent: {article.sentiment.toFixed(2)})</span>
                              <select value={article.category} onChange={(e)=>handleMoveArticle(article.id, e.target.value)} style={{padding:'5px',borderRadius:'4px',border:'1px solid #ccc'}}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px' }}>
        <div style={{...styles.card, padding: '20px', margin: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
          <h3 style={styles.sectionTitle}>Top Sources</h3>
          <div style={{maxHeight: '250px', overflowY: 'auto'}}>
            <table style={{width: '100%'}}><tbody>
              {state.sourceData.slice(0, 10).map(({ domain, count }) => (
                <tr key={domain}><td style={styles.tableCell}>{domain}</td><td style={{...styles.tableCell, textAlign: 'right', fontWeight: 'bold'}}>{count}</td></tr>
              ))}
            </tbody></table>
          </div>
        </div>
        <div style={{...styles.card, padding: '20px', margin: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
          <h3 style={styles.sectionTitle}>Sentiment Timeline</h3>
          <div style={{display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '220px', borderLeft: '2px solid #eee', borderBottom: '2px solid #eee', padding: '5px 0'}}>
            {state.timelineData.slice(-15).map(({ date, average_sentiment }) => {
              const height = Math.abs(average_sentiment) * 100;
              const color = average_sentiment > 0.05 ? '#28a745' : average_sentiment < -0.05 ? '#dc3545' : '#6c757d';
              const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric'});
              return (
                <div key={date} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', flex: 1}}>
                  <div title={`Avg: ${average_sentiment.toFixed(2)} on ${formattedDate}`} style={{width: '25px', height: `${height}%`, backgroundColor: color, borderRadius: '4px 4px 0 0', cursor: 'pointer'}}></div>
                  <span style={{fontSize: '10px', marginTop: '5px', color: '#606770'}}>{formattedDate}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}