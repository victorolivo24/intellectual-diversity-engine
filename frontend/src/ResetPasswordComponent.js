import React, { useState, useEffect } from 'react';
import styles from './styles.js'; // Assuming styles are in a shared file

export default function ResetPasswordComponent({ onLoginNavigate }) {
    const [mode, setMode] = useState('request'); // 'request' or 'reset'
    const [token, setToken] = useState(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // On component mount, check the URL for a reset token
    useEffect(() => {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length === 3 && pathParts[1] === 'reset-password') {
            const urlToken = pathParts[2];
            setToken(urlToken);
            setMode('reset'); // Switch to the password reset form
        }
    }, []);

    const handleRequestReset = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setMessage(data.message); // "If an account exists..."
        } catch (err) {
            setError(err.message);
        }
    };

    const handlePerformReset = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setError('');
        setMessage('');
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/perform-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, new_password: password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setMessage(data.message + " You can now log in.");
            // After a few seconds, redirect to the login page
            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        } catch (err) {
            setError(err.message);
        }
    };

    if (mode === 'reset') {
        return (
            <div style={styles.card}>
                <h2>Set New Password</h2>
                <form onSubmit={handlePerformReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} />
                    <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={styles.input} />
                    {error && <div style={styles.errorText}>{error}</div>}
                    {message && <div style={{ color: 'green', textAlign: 'center' }}>{message}</div>}
                    <button type="submit" style={styles.button}>Reset Password</button>
                </form>
            </div>
        );
    }

    return (
        <div style={styles.card}>
            <h2>Forgot Password</h2>
            <p style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>Enter your username to receive a password reset link.</p>
            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={styles.input} />
                {error && <div style={styles.errorText}>{error}</div>}
                {message && <div style={{ color: 'green', textAlign: 'center' }}>{message}</div>}
                <button type="submit" style={styles.button}>Request Reset Link</button>
            </form>
            <p style={{ marginTop: '15px', textAlign: 'center' }}>
                <span style={{ color: '#1877f2', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
                    Back to Login
                </span>
            </p>
        </div>
    );
}
