// App.js

// 1. IMPORTS: Bring in all the components this file needs.
import React, { useState, useEffect } from 'react';
import DashboardComponent from './DashboardComponent';
import AuthComponent from './AuthComponent';
import AnalysisComponent from './AnalysisComponent'; // The last component we moved
import styles from "./styles.js";

// 2. DEFINITION and EXPORT: Define the component and export it so index.js can use it.
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

  if (!auth) {
    return (
      <div style={styles.container}>
        <AuthComponent onAuth={info => { sessionStorage.setItem('token', info.token); sessionStorage.setItem('username', info.username); setAuth(info); }} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.nav}>
          <button onClick={() => setView('dashboard')} style={{ ...styles.navButton, ...(view === 'dashboard' ? styles.activeNavButton : {}) }}>Dashboard</button>
          <button onClick={() => setView('analyze')} style={{ ...styles.navButton, ...(view === 'analyze' ? styles.activeNavButton : {}) }}>Analyze</button>
          <button onClick={() => { setAuth(null); sessionStorage.clear(); }} style={{ ...styles.navButton, marginLeft: 'auto' }}>Logout</button>
        </div>
        {view === 'dashboard'
          ? <DashboardComponent auth={auth} key={dashboardKey} onRefresh={handleAnalysisComplete} />
          : <AnalysisComponent auth={auth} onBack={() => setView('dashboard')} onAnalysisComplete={handleAnalysisComplete} />
        }
      </div>
    </div>
  );
}