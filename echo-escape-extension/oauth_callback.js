window.onload = function () {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email'); // Or firstName if you updated the backend

    if (token && email) {
        // Save the token and email to the extension's secure storage
        chrome.storage.sync.set({ token: token, email: email }, function () {
            // Send a "fire-and-forget" message. We don't need a callback here.
            chrome.runtime.sendMessage({ action: "login_success" });

            // Close the tab after a very short delay to ensure the message is sent.
            setTimeout(() => window.close(), 100);
            // ---------------------------------
        });
    } else {
        document.body.innerHTML = "<h1>Error: Authentication failed. Please try again.</h1>";
    }
};