// runs on the oauth_callback.html page

window.onload = function() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');

    if (token && email) {
        // Save the token and email to the extension's secure storage
        chrome.storage.sync.set({ token: token, email: email }, function() {
            // After saving, close this tab
            window.close();
        });
    } else {
        document.body.innerHTML = "<h1>Error: Authentication failed. Please try again.</h1>";
    }
};