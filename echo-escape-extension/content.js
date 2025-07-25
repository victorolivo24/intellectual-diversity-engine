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

        if (!articleText) {
            const fallback = document.body.innerText.trim();
            if (fallback.length > 100) {
                articleText = fallback;
            }
        }

        // Send both the visible text and full HTML (for metadata)
        const fullHTML = new XMLSerializer().serializeToString(document);

        sendResponse({
            page_html: fullHTML,
            page_text: articleText
        });
    }

    return true;
});
