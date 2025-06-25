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

 // In App.js

useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoTicket = params.get('sso_ticket');

    if (ssoTicket) {
      // If a one-time ticket is in the URL, redeem it
      fetch('http://127.0.0.1:5000/redeem_sso_ticket', { // Your API_URL
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sso_ticket: ssoTicket })
      })
      .then(res => res.json())
      .then(data => {
          if (data.token) {
              // We got a real token back! Log the user in.
              sessionStorage.setItem('token', data.token);
              sessionStorage.setItem('username', data.username);
              setAuth({ token: data.token, username: data.username });
          }
          // Clean the URL to remove the one-time ticket
          window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(err => {
        console.error(err);
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    } else {
      // If no ticket, check for an existing session as usual
      const storedToken = sessionStorage.getItem('token');
      const storedUsername = sessionStorage.getItem('username');
      if (storedToken && storedUsername) {
        setAuth({ token: storedToken, username: storedUsername });
      }
    }
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