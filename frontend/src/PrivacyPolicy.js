import React from 'react';
import styles from './styles.js'; 

export default function PrivacyPolicy() {
    return (
        <div style={{ ...styles.card, maxWidth: '800px', margin: '50px auto' }}>
            <h1 style={{ ...styles.title, textAlign: 'center' }}>Privacy Policy for Out of the Loop</h1>
            <p style={{ textAlign: 'center', color: '#666' }}>Last updated: July 26, 2025</p>

            <div style={{ marginTop: '30px', lineHeight: '1.6', color: '#f1f1f1' }}>
                <p>Welcome to Out of the Loop. We are committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your choices regarding your information.</p>

                <h2 style={styles.sectionTitle}>1. Information We Collect</h2>
                <ul>
                    <li><strong>Account Information:</strong> When you register for an account, we collect your email address, first name, and a securely hashed version of your password. If you sign in with Google, we receive your email and first name from your Google profile.</li>
                    <li><strong>Analyzed Content:</strong> When you choose to save an analysis to your dashboard, we store the article's URL, title, full text, and the resulting sentiment score, keywords, and category. This data is linked to your account to populate your personal dashboard.</li>
                </ul>

                <h2 style={styles.sectionTitle}>2. How We Use Your Information</h2>
                <ul>
                    <li>To provide and maintain the service, including authenticating you and displaying your personalized dashboard.</li>
                    <li>To improve the application and its features. We do not use your personal article text to train our models.</li>
                </ul>

                <h2 style={styles.sectionTitle}>3. Data Sharing and Transfer</h2>
                <p>We do not sell, trade, or otherwise transfer your personally identifiable information to third parties. The content of articles you analyze is processed by our secure backend server and is not shared.</p>

                <h2 style={styles.sectionTitle}>4. Data Deletion</h2>
                <p>You have full control over your data. You can delete your account at any time from your dashboard. When you delete your account, all of your personal information and saved article history are permanently removed from our servers.</p>

                <h2 style={styles.sectionTitle}>5. Contact Us</h2>
                <p>If you have any questions about this Privacy Policy, you can contact us at victormolivo3@gmail.com.</p>
            </div>
        </div>
    );
}
