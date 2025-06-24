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

    // --- NEW CODE STARTS HERE ---
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent the form from reloading the popup

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        // Send the login request to the backend
        fetch(API_URL + '/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                // If response is not 2xx, parse the error message from the backend
                return response.json().then(err => { throw new Error(err.message) });
            }
            return response.json();
        })
        .then(data => {
            // Login was successful!
            // Save the token and username to the extension's storage
            chrome.storage.sync.set({ token: data.token, username: data.username }, function() {
                // Now that the token is saved, show the main analysis view
                renderAnalysisView(container, data.username);
            });
        })
        .catch(error => {
            // Display any errors (e.g., "Invalid credentials") to the user
            errorMessageDiv.textContent = error.message;
        });
    });
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