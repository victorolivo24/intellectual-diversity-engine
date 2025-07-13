import pandas as pd
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
import concurrent.futures
import time


def extract_article_text(soup, url=None):
    domain = urlparse(url).netloc if url else ""
    for tag in ["script", "style", "header", "footer", "nav", "aside"]:
        for s in soup.select(tag):
            s.decompose()

    # NYT handling
    if "nytimes.com" in domain:
        title = soup.find("title")
        return title.get_text(strip=True) if title else "nytimes.com"

    article_tag = soup.find("article")
    if article_tag:
        return article_tag.get_text(separator="\n", strip=True)

    return soup.get_text(separator="\n", strip=True)


def scrape(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(url, timeout=10, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        return extract_article_text(soup, url)
    except Exception as e:
        print(f"❌ Failed to scrape {url}: {e}")
        return ""


# Load CSV
df = pd.read_csv("mind_articles.csv")

# Extract URLs from full_text using regex
df["url"] = df["full_text"].str.extract(r"(https?://\S+)")
df = df.dropna(subset=["url"])  # drop rows without a URL

print(f"📝 Found {len(df)} valid URLs. Beginning scrape...")

# Multithread scrape
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(scrape, df["url"]))

df["scraped_text"] = results

# Save
df.to_csv("mind_articles_scraped.csv", index=False)
print("✅ Saved mind_articles_scraped.csv with full article content.")
