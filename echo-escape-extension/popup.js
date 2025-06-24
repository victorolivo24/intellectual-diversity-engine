// The backend API endpoint
const API_URL = 'http://127.0.0.1:5000';

// This is the main function that runs when the popup is opened
document.addEventListener('DOMContentLoaded', function() {
    const rootContainer = document.getElementById('root-container');

    // Check if we have a token stored from a previous session
    chrome.storage.sync.get(['token', 'username'], function(result) {
        if (result.token) {
            // If we have a token, the user is logged in.
            // Show the main analysis view.
            renderAnalysisView(rootContainer, result.username);
        } else {
            // If not, show the login form.
            renderLoginForm(rootContainer);
        }
    });
});

/**
 * Renders the HTML for the login form into the container.
 * @param {HTMLElement} container The element to inject the HTML into.
 */
function renderLoginForm(container) {
    container.innerHTML = `
        <h3>Login</h3>
        <form id="login-form">
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
    `;
    // We will add the logic for this form in the next step
}

/**
 * Renders the main view for a logged-in user.
 * @param {HTMLElement} container The element to inject the HTML into.
 * @param {string} username The user's username.
 */
function renderAnalysisView(container, username) {
    container.innerHTML = `
        <h3>Welcome, ${username}!</h3>
        <p>Click the button below to analyze the article on the current page.</p>
        <button id="analyze-button" class="button">Analyze Page</button>
        <div id="results-container"></div>
    `;
    // We will add logic for this button later
}