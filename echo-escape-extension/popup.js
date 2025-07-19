// Final popup.js

const API_URL = 'http://127.0.0.1:5000';
// We'll replace this with the real URL after deploying the dashboard website
const DASHBOARD_URL = 'http://localhost:3000'; // Or whatever your local React dev server is

// This is the main function that runs when the popup is opened
document.addEventListener('DOMContentLoaded', function () {
    const rootContainer = document.getElementById('root-container');
    checkAuthState(rootContainer);
});


function checkAuthState(container) {
    chrome.storage.sync.get(['token'], function (result) {
        const token = result.token;
        if (!token) {
            // If no token exists, show login form immediately
            renderLoginForm(container);
            return;
        }

        // If a token exists, VERIFY it with the backend
        fetch(`${API_URL}/me`, {
            headers: { 'x-access-token': token }
        })
            .then(response => {
                if (!response.ok) {
                    // If the token is invalid (e.g., user deleted), throw an error
                    throw new Error('Invalid session');
                }
                return response.json();
            })
            .then(data => {
                // Success! The token is valid.
                renderAnalysisView(container, data.email);
            })
            .catch(error => {
                // The token was invalid. Log the user out of the extension.
                console.error("Token validation failed:", error.message);
                chrome.storage.sync.remove(['token', 'email']);
                renderLoginForm(container);
            });
    });
}
// --- RENDER FUNCTIONS ---


function renderLoginForm(container) {
    container.innerHTML = `
        <h3>Login</h3>
        <form id="auth-form">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit" class="button">Login</button>
            <div id="error-message" class="error-message"></div>
        </form>
        
        <div style="text-align: center; margin: 10px 0; color: #666; font-size: 12px;">OR</div>
        
        <!-- The link now has an ID so we can add a listener to it -->
        <a href="#" id="google-login-button" class="button google-button">
            Sign in with Google
        </a>
        
        <p class="auth-switch" style="margin-top: 15px;">
            Don't have an account? <a href="#" id="show-register">Register</a>
        </p>
        <p class="auth-switch" style="margin-top: 5px;">
            <a href="#" id="forgot-password-link">Forgot Password?</a>
        </p>
    `;

    // event listeners for the form and links
    document.getElementById('email').focus(); // Focus the email input by default
    document.getElementById('auth-form').addEventListener('submit', (e) => handleAuth('login', container, e));
    document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); renderRegisterForm(container); });
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${DASHBOARD_URL}/reset-password` });
    });

    document.getElementById('google-login-button').addEventListener('click', (e) => {
        e.preventDefault();
        // Use the correct API to open the login page in a new tab
        chrome.tabs.create({ url: 'http://127.0.0.1:5000/login/google?state=extension' });
        window.close(); // Close the popup after the user clicks
    });
}

function renderRegisterForm(container) {
    container.innerHTML = `
        <h3>Register</h3>
        <form id="auth-form">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="text" id="email" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit" class="button">Register</button>
            <div id="error-message" class="error-message"></div>
        </form>
        <p class="auth-switch">Already have an account? <a href="#" id="show-login">Login</a></p>
    `;

    document.getElementById('auth-form').addEventListener('submit', (e) => handleAuth('register', container, e));
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        renderLoginForm(container);
    });
}

function renderAnalysisView(container, email) {
    container.innerHTML = `
        <div class="header">
            <span>Welcome, ${email}!</span>
            <a href="#" id="logout-button">Logout</a>
        </div>
        <p>Click to analyze the article on the current page.</p>
        <button id="analyze-button" class="button">Analyze Page</button>
        <div id="results-container" class="results-container"></div>
        <div class="footer">
            <a href="#" id="dashboard-link">View Full Dashboard</a>
        </div>
    `;

    document.getElementById('analyze-button').addEventListener('click', () => handleAnalysis());
    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout(container);
    });
   

    document.getElementById('dashboard-link').addEventListener('click', (e) => {
        e.preventDefault();

        // Get the main login token to prove who we are
        chrome.storage.sync.get(['token'], function (result) {
            if (result.token) {
                // Ask the backend to generate a special, one-time ticket
                fetch(`${API_URL}/generate_sso_ticket`, {
                    method: 'POST',
                    headers: { 'x-access-token': result.token }
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.sso_ticket) {
                            // Open the dashboard URL with the SAFE, single-use ticket
                            const urlWithTicket = `${DASHBOARD_URL}?sso_ticket=${data.sso_ticket}`;
                            chrome.tabs.create({ url: urlWithTicket });
                        }
                    })
                    .catch(err => console.error(err));
            }
        });
    });
}

function renderResults(container, data) {

    if (data === null) {
        container.innerHTML = `
            <div class="error-message">
                ⚠️ ${message}
            </div>
        `;
        return;
    }

    
  

    const keywordsHtml = data.keywords.map(kw => `<li class="keyword-pill">${kw}</li>`).join('');

    container.innerHTML = `
        <h4>Analysis for: ${data.title}</h4>
        <div class="result-item">
            <strong>Sentiment Score:</strong>
            <span class="sentiment-score" style="color: ${data.sentiment > 0.05 ? '#28a745' : data.sentiment < -0.05 ? '#dc3545' : 'inherit'}">
                ${data.sentiment.toFixed(2)}
            </span>
        </div>
        <div class="result-item">
            <strong>Keywords:</strong>
            <ul class="keywords-list">${keywordsHtml}</ul>
        </div>
    `;
}


// --- HANDLER FUNCTIONS ---

function handleLogout(container) {
    chrome.storage.sync.remove(['token', 'email'], () => {
        renderLoginForm(container);
    });
}

function handleAuth(mode, container, e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessageDiv = document.getElementById('error-message');
    const submitButton = e.target.querySelector('button');

    errorMessageDiv.textContent = '';
    submitButton.textContent = '...';
    submitButton.disabled = true;

    fetch(`${API_URL}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'An error occurred.') });
            }
            return response.json();
        })
        .then(data => {
            if (mode === 'login') {
                chrome.storage.sync.set({ token: data.token, refreshToken: data.refresh_token, email: data.email }, () => {
                    checkAuthState(container);
                });
            } else {
                errorMessageDiv.style.color = 'green';
                errorMessageDiv.textContent = 'Registration successful! Please log in.';
            }
        })
        .catch(error => {
            errorMessageDiv.style.color = '#fa383e';
            errorMessageDiv.textContent = error.message;
        })
        .finally(() => {
            submitButton.textContent = mode.charAt(0).toUpperCase() + mode.slice(1); // Reset button text
            submitButton.disabled = false;
        });
}
function handleAnalysis() {
    const analyzeButton = document.getElementById('analyze-button');
    const resultsContainer = document.getElementById('results-container');

    resultsContainer.innerHTML = 'Getting page content...';
    analyzeButton.textContent = 'Working...';
    analyzeButton.disabled = true;

    // Send a message to the background script to get the page content
    chrome.runtime.sendMessage({ action: "get_page_content" }, function (response) {
        if (chrome.runtime.lastError || !response || !response.page_html) {
            resultsContainer.innerHTML = `<div class="error-message">Could not get content from this page.</div>`;
            analyzeButton.textContent = 'Analyze Page';
            analyzeButton.disabled = false;
            return;
        }

        resultsContainer.innerHTML = '<div style="text-align: center; padding: 10px;"><div class="spinner"></div><p>Analyzing...</p></div>';
        const pageHtml = response.page_html;

        // Get the stored token
        chrome.storage.sync.get(['token'], function (result) {
            if (!result.token) {
                resultsContainer.innerHTML = '<div class="error-message">Error: Not logged in.</div>';
                return;
            }

            //  Send the FULL HTML to the backend for analysis
            fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': result.token
                },
                body: JSON.stringify({ html_content: pageHtml }) // Send HTML instead of URL
            })
                .then(res => {
                    if (!res.ok) return res.json().then(err => { throw new Error(err.message) });
                    return res.json();
                })
                .then(data => {
                    if (data.data) {
                        renderResults(resultsContainer, data.data);
                    } else {
                        throw new Error(data.message || 'Analysis failed.');
                    }
                })
                .catch(error => {
                    resultsContainer.innerHTML = `<div class="error-message">${error.message}</div>`;
                })
                .finally(() => {
                    if (document.contains(analyzeButton)) {
                        analyzeButton.textContent = 'Analyze Page';
                        analyzeButton.disabled = false;
                    }
                });
        });
    });
}