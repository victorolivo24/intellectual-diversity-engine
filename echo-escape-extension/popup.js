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
    chrome.storage.sync.get(['token', 'username'], function (result) {
        if (result.token && result.username) {
            renderAnalysisView(container, result.username);
        } else {
            renderLoginForm(container);
        }
    });
}

// --- RENDER FUNCTIONS ---

function renderLoginForm(container) {
    container.innerHTML = `
        <h3>Login</h3>
        <form id="auth-form">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" required>
            </div>
            <button type="submit" class="button">Login</button>
            <div id="error-message" class="error-message"></div>
        </form>
        <p class="auth-switch">Don't have an account? <a href="#" id="show-register">Register</a></p>
    `;

    document.getElementById('auth-form').addEventListener('submit', (e) => handleAuth('login', container, e));
    document.getElementById('show-register').addEventListener('click', (e) => {
        e.preventDefault();
        renderRegisterForm(container);
    });
}

function renderRegisterForm(container) {
    container.innerHTML = `
        <h3>Register</h3>
        <form id="auth-form">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" required>
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

function renderAnalysisView(container, username) {
    container.innerHTML = `
        <div class="header">
            <span>Welcome, ${username}!</span>
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
    chrome.storage.sync.remove(['token', 'username'], () => {
        renderLoginForm(container);
    });
}

function handleAuth(mode, container, e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessageDiv = document.getElementById('error-message');
    const submitButton = e.target.querySelector('button');

    errorMessageDiv.textContent = '';
    submitButton.textContent = '...';
    submitButton.disabled = true;

    fetch(`${API_URL}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.message || 'An error occurred.') });
            }
            return response.json();
        })
        .then(data => {
            if (mode === 'login') {
                chrome.storage.sync.set({ token: data.token, refreshToken: data.refresh_token, username: data.username }, () => {
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

        resultsContainer.innerHTML = 'Analyzing...';
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