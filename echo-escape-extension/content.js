chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "get_page_content") {
        let articleText = "";

        const selectors = [
            'article',
            '[data-qa="story-body"]',              
            '[itemprop="articleBody"]',
            'main',
            '[class*="article-content"]',
            '[class*="story-body"]'
        ];

        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText.trim().length > 100) {
                articleText = el.innerText.trim();
                break;
            }
        }

        // Fallback: if nothing matched, use body text
        if (!articleText) {
            const fallback = document.body.innerText.trim();
            if (fallback.length > 100) {
                articleText = fallback;
            }
        }

        console.log("📄 Extracted text:", articleText.slice(0, 200));  // Optional for debugging
        sendResponse({ page_html: articleText });
    }

    return true;
});
