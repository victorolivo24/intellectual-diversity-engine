// Listens for a message from another part of the extension (the background script)
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

    // Check if the message is the one we're looking for
    if (request.action === "get_page_content") {

        // If it is, grab the entire HTML of the page this script is running on
        const pageHtml = document.documentElement.outerHTML;

        // Send the HTML back as a response
        sendResponse({ page_html: pageHtml });
    }

    // This is required to allow for an asynchronous response
    return true;
});