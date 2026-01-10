const API_URL = 'https://victoro24-echo-escape-api.hf.space';
const DASHBOARD_URL = 'https://out-of-the-loop.netlify.app';

// This is the main function that runs when the popup is opened
document.addEventListener('DOMContentLoaded', function () {
    const rootContainer = document.getElementById('root-container');
    checkAuthState(rootContainer);

    // listener that waits for messages from other parts of the extension
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        // Check if the message is the one we're looking for
        if (request.action === "login_success") {
            console.log("Login success message received, refreshing popup.");
            // If so, re-run the authentication check to refresh the UI
            checkAuthState(rootContainer);
        }
    });
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
// display results and checkbox to save to dashboard
function renderAnalysisView(container, email) {
    container.innerHTML = `
        <div class="header"><span>Welcome, ${email}!</span><a href="#" id="logout-button">Logout</a></div>
        <p>Click to analyze the article on the current page.</p>
        <button id="analyze-button" class="button">Analyze Page</button>
        <div id="results-container" class="results-container"></div>
        <div class="footer"><a href="#" id="dashboard-link">View Full Dashboard</a></div>
    `;
    document.getElementById('analyze-button').addEventListener('click', handleAnalysis);
    document.getElementById('logout-button').addEventListener('click', (e) => { e.preventDefault(); handleLogout(container); });
    document.getElementById('dashboard-link').addEventListener('click', (e) => { e.preventDefault(); handleDashboardLink(); });
}


function renderResults(container, analysisData) {
    // Sanitize title to prevent HTML injection issues
    const safeTitle = analysisData.title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const keywordsHtml = analysisData.keywords.map(kw => `<li class="keyword-pill">${kw}</li>`).join('');
    container.innerHTML = `
        <div class="results-view">
            <h3>Analysis Complete</h3>
            <div class="article-header">
                <h4 class="article-title">${safeTitle}</h4>
                <p class="article-publisher">${analysisData.publisher || ''}</p>
            </div>
            <p style="font-size: 12px; color: #B0B3B8; text-align: center; margin-top: -5px; margin-bottom: 10px;">
                Score is rated from -1.0 (Negative) to 1.0 (Positive).
            </p>
            <div class="result-item">
                <strong>Sentiment Score:</strong>
                <span class="sentiment-score" style="color: ${analysisData.sentiment > 0.05 ? '#28a745' : analysisData.sentiment < -0.05 ? '#dc3545' : 'inherit'}">
                    ${analysisData.sentiment.toFixed(2)}
                </span>
            </div>
            <div class="result-item">
                <strong>Keywords:</strong>
                <ul class="keywords-list">${keywordsHtml}</ul>
            </div>
            <hr class="results-divider">
            <div class="save-option">
                <input type="checkbox" id="save-history-checkbox" checked>
                <label for="save-history-checkbox">Include in Dashboard</label>
            </div>
            <button id="done-button" class="button">Done</button>
            <div id="history-info" class="history-info hidden">
                You’ve saved <span id="history-count"></span> articles.
            </div>


        </div>
    `;

    document.getElementById('done-button').addEventListener('click', () => {
        handleSave(analysisData);
    });
}
function signInWithGoogle(container) {
    // This function uses the 'oauth2' configuration from your manifest.json
    chrome.identity.getAuthToken({ interactive: true }, function (googleAccessToken) {
        if (chrome.runtime.lastError || !googleAccessToken) {
            console.error("Could not get Google access token:", chrome.runtime.lastError.message);
            // Optionally render an error message in the popup
            document.body.innerHTML = `<p>Error: ${chrome.runtime.lastError.message}</p>`;
            return;
        }

        console.log("✅ Got Google access token:", googleAccessToken);

        // Now, send this token to your backend to exchange it for your app's JWT

        fetch(`${API_URL}/auth/google/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: googleAccessToken }),
        })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Backend returned status ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (data.token && data.email) {
                    // Save your application's token (JWT) and user email
                    chrome.storage.sync.set({ token: data.token, email: data.email }, () => {
                        console.log("✅ Successfully logged in as", data.email);
                        renderAnalysisView(container, data.email);

                        chrome.runtime.sendMessage({ action: "login_success" });
                    });
                } else {
                    container.innerHTML = `<p style="color: red;">Login failed. Please try again.</p>`;
                    console.error("❌ Backend response missing token/email:", data);
                }
            })
            .catch((err) => {
                console.error("Error sending token to backend:", err);
            });
    });
}

function renderLoginForm(container) {
    container.innerHTML = `
        <h3>Login</h3>
        <form id="auth-form">
            <div class="form-group"><label for="email">Email</label><input type="email" id="email" required></div>
            <div class="form-group"><label for="password">Password</label><input type="password" id="password" required></div>
            <button type="submit" class="button">Login</button>
            <div id="error-message" class="error-message"></div>
        </form>
        
        <div style="text-align: center; margin: 10px 0; color: #666; font-size: 12px;">OR</div>
        
        <!-- THIS IS THE NEW GOOGLE BUTTON -->
        <a href="#" id="google-login-button" class="google-btn">
            <div class="google-icon-wrapper">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 48 48">
                    <g>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 11.22l7.97-6.22z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </g>
                </svg>
            </div>
            <p class="btn-text"><b>Sign in with Google</b></p>
        </a>
        
        <p class="auth-switch" style="margin-top: 15px;">
            Don't have an account? <a href="#" id="show-register">Register</a>
        </p>
        <p class="auth-switch" style="margin-top: 5px;">
            <a href="#" id="forgot-password-link">Forgot Password?</a>
        </p>
    `;

    // Wire up event listeners
    document.getElementById('auth-form').addEventListener('submit', (e) => handleAuth('login', container, e));
    document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); renderRegisterForm(container); });
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${DASHBOARD_URL}/reset-password` });
    });
    document.getElementById('google-login-button').addEventListener('click', (e) => {
        e.preventDefault();

        // This line is the one we need to verify
        const container = document.getElementById('root-container');

        // If 'container' is null here, the next line will crash
        container.innerHTML = `<div style="text-align: center; padding: 20px;"><p>Waiting for Google Sign-In...</p></div>`;

        signInWithGoogle(container);
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
    const rootContainer = document.getElementById('root-container');

    //  Disable button
    analyzeButton.disabled = true;
    analyzeButton.textContent = '';

    //  Inject skeleton UI
    resultsContainer.innerHTML = `
  <div class="skeleton title"></div>
  <div class="skeleton sentiment"></div>
  <ul class="skeleton-list">
    <li class="skeleton-item"></li>
    <li class="skeleton-item"></li>
    <li class="skeleton-item"></li>
  </ul>
`;
    // Send message to background script to get the current page content

    chrome.runtime.sendMessage({ action: "get_page_content" }, function (response) {
        if (chrome.runtime.lastError || !response || !response.page_html) {
            resultsContainer.innerHTML = `<div class="error-message">Could not get content from this page.</div>`;
            analyzeButton.textContent = 'Analyze Page';
            analyzeButton.disabled = false;
            return;
        }

        resultsContainer.innerHTML = 'Analyzing...';
        const pageHtml = response.page_html;

        chrome.storage.sync.get(['token'], function (result) {
            if (!result.token) {
                resultsContainer.innerHTML = '<div class="error-message">Error: Not logged in.</div>';
                return;
            }
            console.log("Sending to /analyze:");
            console.log("Length of html_content:", response.page_html.length);
            console.log("Length of visible_text:", response.page_text.length);

            fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-access-token': result.token },
                body: JSON.stringify({
                    html_content: response.page_html,
                    visible_text: response.page_text
                })

            })
                .then(async res => {
                    const text = await res.text();  // always read raw text

                    try {
                        const json = JSON.parse(text);

                        if (!res.ok) {
                            throw new Error(json.message || 'Unexpected server error.');
                        }

                        return json;
                    } catch (err) {
                        console.error("❌ Failed to parse JSON. Raw response was:");
                        console.error(text);  // This will show the "<!DOCTYPE..." if it failed
                        throw new Error("Server returned invalid JSON. Site may be blocking content.");
                    }
                })

                .then(data => {
                    if (data.data) {
                        // On success, call the new renderResults function
                        renderResults(resultsContainer, data.data);
                    } else {
                        throw new Error(data.message || 'Analysis failed.');
                    }
                })
                .catch(error => {
                    resultsContainer.innerHTML = `<div class="error-message">${error.message}</div>`;
                    analyzeButton.textContent = 'Analyze Page';
                    analyzeButton.disabled = false;
                });
        });
    });
}
// show the history count once Save completes
function showHistoryInfo(count) {
    const historyInfo = document.getElementById('history-info');
    const countSpan = document.getElementById('history-count');
    if (!historyInfo || !countSpan) {
        console.warn('Cannot show history info: element(s) missing');
        return;
    }
    countSpan.textContent = count;
    historyInfo.classList.remove('hidden');
}

function handleSave(analysisData) {
    const shouldSave = document.getElementById('save-history-checkbox').checked;

    if (shouldSave) {
        chrome.storage.sync.get(['token'], function (result) {
            if (!result.token) {
                console.error("Cannot save, user not logged in.");
                return;
            }
            // Send all the analysis data to a new /save route
            fetch(`${API_URL}/save_analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-access-token': result.token
                },
                body: JSON.stringify({
                    ...analysisData, // Includes title, sentiment, keywords, etc.
                    save_to_history: true
                })
            })
                .then(async response => {
                    const json = await response.json();
                    if (!response.ok) {
                        throw new Error(json.message || 'Save failed');
                    }
                    return json;
                })
                .then(json => {
                    showToast(json.message);
                    // remove the Done button
                    document.getElementById('done-button')?.remove();
                    // remove the include-in-dashboard checkbox
                    document.querySelector('.save-option')?.remove();
                    // reveal the updated history count
                    showHistoryInfo(json.count);
                })
                .catch(err => {
                    console.error("Error saving analysis:", err);
                    showToast(err.message);
                    document.getElementById('done-button')?.remove();
                    document.querySelector('.save-option')?.remove();
                });
        });
    } else {
        // user opted out of saving
        showToast('Skipped saving');
        document.getElementById('done-button')?.remove();
        document.querySelector('.save-option')?.remove();
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 2500);
}
