import React, { useState, useEffect } from 'react';
import DashboardComponent from './DashboardComponent';
import AuthComponent from './AuthComponent';
import AnalysisComponent from './AnalysisComponent';
import ResetPasswordComponent from './ResetPasswordComponent';
import styles from "./styles.js";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('dashboard');
  const [dashboardKey, setDashboardKey] = useState(0);

  const isResetRoute = window.location.pathname.startsWith('/reset-password');

  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const ssoTicket = params.get('sso_ticket');

    if (token) {
      // Case 1: A direct token from Google OAuth login
      // We need to fetch the email associated with this new token
      fetch('http://127.0.0.1:5000/me', { headers: { 'x-access-token': token } })
        .then(res => res.json())
        .then(data => {
          if (data.email) {
            sessionStorage.setItem('token', token);
            sessionStorage.setItem('email', data.email);
            setAuth({ token, email: data.email });
          }
        });
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);

    } else if (ssoTicket) {
      // Case 2: An SSO ticket from the browser extension
      fetch('http://127.0.0.1:5000/redeem_sso_ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sso_ticket: ssoTicket })
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('email', data.email);
            setAuth({ token: data.token, email: data.email });
          }
        });
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);

    } else {
      // Case 3: A normal page load, check for an existing session
      const storedToken = sessionStorage.getItem('token');
      const storedEmail = sessionStorage.getItem('email');
      if (storedToken && storedEmail) {
        setAuth({ token: storedToken, email: storedEmail });
      }
    }
  }, []);

  const handleAnalysisComplete = () => {
    setDashboardKey(k => k + 1);
  };

  if (isResetRoute) {
    return <div style={styles.container}><ResetPasswordComponent /></div>;
  }

  if (!auth) {
    return (
      <div style={styles.container}>
        <AuthComponent onAuth={info => {
          sessionStorage.setItem('token', info.token);
          sessionStorage.setItem('email', info.email);
          setAuth(info);
        }} />
      </div>
    );
  }
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* logo and header */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderBottom: '1px solid #333',
          padding: '0 16px',
          width: '100%',
          height: '64px', // or your preferred header height
          overflow: 'hidden'
        }
}>
          <img
            src="/transparentlogo.png"
            alt="Out of the Loop logo"
            style={{
              maxHeight: '500px', // increased height for a larger logo
              width: '38%',
              objectFit: 'contain'
            }}
          />
        </div>


        {/* simple navigation: only Dashboard + Logout */}
        <div style={styles.nav}>
          <button
            style={{ ...styles.navButton, ...styles.activeNavButton }}
          >
            Dashboard
          </button>
          <button
            onClick={() => {
              sessionStorage.clear();
              setAuth(null);
            }}
            style={{ ...styles.navButton, marginLeft: 'auto' }}
          >
            Logout
          </button>
        </div>

        {/* always show the dashboard */}
        <DashboardComponent
          auth={auth}
          onRefresh={handleAnalysisComplete}
          setAuth={setAuth}
          refreshKey={dashboardKey}
        />
      </div>
    </div>
  );
}