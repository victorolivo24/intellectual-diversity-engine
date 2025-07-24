chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "get_page_content") {
        // Try to extract visible article text instead of the full HTML
        let articleText = "";

        // Try common selectors (can expand this list later)
        const article = document.querySelector("article");
        if (article) {
            articleText = article.innerText;
        } else {
            // Try fallback selectors for some news sites
            const mainContent = document.querySelector("main");
            if (mainContent) {
                articleText = mainContent.innerText;
            } else {
                // If all else fails, get the entire body
                articleText = document.body.innerText;
            }
        }

        sendResponse({ page_html: articleText });
    }

    return true;
});
