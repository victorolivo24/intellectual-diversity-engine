// App.js

import React, { useState, useEffect } from 'react';
import DashboardComponent from './DashboardComponent';
import AuthComponent from './AuthComponent';
import AnalysisComponent from './AnalysisComponent';
import styles from "./styles.js";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('dashboard');
  const [dashboardKey, setDashboardKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoTicket = params.get('sso_ticket');

    if (ssoTicket) {
      // one-time ticket from extension
      fetch('http://127.0.0.1:5000/redeem_sso_ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sso_ticket: ssoTicket })
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('username', data.username);
            setAuth({ token: data.token, username: data.username });
          }
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch(err => {
          console.error(err);
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else {
      // fallback: use existing session
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
        <AuthComponent onAuth={info => {
          sessionStorage.setItem('token', info.token);
          sessionStorage.setItem('username', info.username);
          setAuth(info);
        }} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* professional header with logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '16px',
          borderBottom: '1px solid #333',
          paddingBottom: '8px'
        }}>
          <img
            src="/transparentlogo.png"
            alt="Out of the Loop logo"
            style={{ width: '32px', height: '32px', borderRadius: '4px' }}
          />
          <h1 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Out of the Loop
          </h1>
        </div>

        {/* navigation */}
        <div style={styles.nav}>
          <button
            onClick={() => setView('dashboard')}
            style={{
              ...styles.navButton,
              ...(view === 'dashboard' ? styles.activeNavButton : {})
            }}>
            Dashboard
          </button>
          <button
            onClick={() => setView('analyze')}
            style={{
              ...styles.navButton,
              ...(view === 'analyze' ? styles.activeNavButton : {})
            }}>
            Analyze
          </button>
          <button
            onClick={() => {
              setAuth(null);
              sessionStorage.clear();
            }}
            style={{
              ...styles.navButton,
              marginLeft: 'auto'
            }}>
            Logout
          </button>
        </div>

        {/* content */}
        {view === 'dashboard' ? (
          
          <DashboardComponent auth={auth} onRefresh={handleAnalysisComplete} setAuth={setAuth} />
        ) : (
          <AnalysisComponent
            auth={auth}
            onBack={() => setView('dashboard')}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}
      </div>
    </div>
  );
}
