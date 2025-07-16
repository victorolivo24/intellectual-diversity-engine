// Listens for a message from the popup.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "get_page_content") {
        // When it gets the message, it forwards it to the content script on the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "get_page_content" }, function (response) {
                // It then sends the response from the content script back to the popup
                sendResponse(response);
            });
        });
        return true; // Keep the message channel open for the asynchronous response
    }
});