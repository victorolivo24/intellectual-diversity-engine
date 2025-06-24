// In popup.js

const API_URL = 'http://127.0.0.1:5000';

// This is the main function that runs when the popup is opened
document.addEventListener('DOMContentLoaded', function() {
    const rootContainer = document.getElementById('root-container');

    // Check if we have a token stored from a previous session
    chrome.storage.sync.get(['token', 'username'], function(result) {
        if (result.token) {
            renderAnalysisView(rootContainer, result.username);
        } else {
            renderLoginForm(rootContainer);
        }
    });
});

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

// THIS IS THE FUNCTION THAT WAS MISSING
function renderAnalysisView(container, username) {
    container.innerHTML = `
        <h3>Welcome, ${username}!</h3>
        <p>Click the button below to analyze the article on the current page.</p>
        <button id="analyze-button" class="button">Analyze Page</button>
        <div id="results-container" class="results-container"></div>
    `;
    
    const analyzeButton = document.getElementById('analyze-button');
    const resultsContainer = document.getElementById('results-container');
    analyzeButton.addEventListener('click', () => handleAnalysis(resultsContainer));
}

function renderResults(container, data) {
    const keywordsHtml = data.keywords.map(kw => `<li>${kw}</li>`).join('');

    container.innerHTML = `
        <h4>Analysis for: ${data.title}</h4>
        <div class="result-item">
            <strong>Sentiment Score:</strong>
            <span>${data.sentiment.toFixed(2)}</span>
        </div>
        <div class="result-item">
            <strong>Keywords:</strong>
            <ul>${keywordsHtml}</ul>
        </div>
    `;
}

// --- HANDLER FUNCTIONS ---

function handleAuth(mode, container, e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessageDiv = document.getElementById('error-message');
    errorMessageDiv.textContent = ''; // Clear previous errors

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
            chrome.storage.sync.set({ token: data.token, username: data.username }, () => {
                renderAnalysisView(container, data.username);
            });
        } else { // Registration success
            errorMessageDiv.style.color = 'green';
            errorMessageDiv.textContent = 'Registration successful! Please log in.';
        }
    })
    .catch(error => {
        errorMessageDiv.style.color = '#fa383e';
        errorMessageDiv.textContent = error.message;
    });
}

// THIS IS THE OTHER HELPER FUNCTION THAT WAS MISSING
function handleAnalysis(resultsContainer) {
    resultsContainer.innerHTML = 'Analyzing...';
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url) {
            resultsContainer.innerHTML = '<div class="error-message">Could not get URL of current tab.</div>';
            return;
        }

        chrome.storage.sync.get(['token'], function(result) {
            if (!result.token) {
                resultsContainer.innerHTML = '<div class="error-message">Error: Not logged in.</div>';
                return;
            }

            fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': result.token
                },
                body: JSON.stringify({ url: currentTab.url })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw new Error(err.message || 'Analysis failed.') });
                }
                return response.json();
            })
            .then(data => {
                if (data.data) {
                    renderResults(resultsContainer, data.data);
                } else {
                    throw new Error(data.message || 'Invalid data received.');
                }
            })
            .catch(error => {
                resultsContainer.innerHTML = `<div class="error-message">${error.message}</div>`;
            });
        });
    });
}