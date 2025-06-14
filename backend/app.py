from flask import Flask, request, jsonify
from bs4 import BeautifulSoup

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from flask_sqlalchemy import SQLAlchemy


app = Flask(__name__)

# --- DATABASE CONFIGURATION ---
# Make sure to replace YOUR_PASSWORD with the password you set during the PostgreSQL installation.
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:Victhequick24$@localhost/intellectual_diversity_engine'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

@app.route('/')
def index():
    return "Hello, World! The Echo Escape server is running."

@app.route('/analyze', methods=['POST'])
def analyze_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400

    url = data['url']
    print(f"Received URL for analysis: {url}")
    
    driver = None
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'})
        
        driver.get(url)
        
        wait = WebDriverWait(driver, 15)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))

        html = driver.page_source
        
        # --- NEW EXTRACTION LOGIC ---
        soup = BeautifulSoup(html, 'html.parser')
        
        # Extract Title (as before)
        title_tag = soup.find('title')
        title = title_tag.get_text() if title_tag else "No title found"
        
        # Extract Author from meta tag
        author_tag = soup.find('meta', property='article:author')
        author = author_tag['content'] if author_tag else "No author found"

        # Extract Published Date from meta tag
        date_tag = soup.find('meta', property='article:published_time')
        publish_date = date_tag['content'] if date_tag else "No publish date found"

        # --- NEW, MORE ROBUST TEXT EXTRACTION ---
        article_text = "No article text found" # Default value
        main_content = soup.find('main') # Find the <main> content block of the page

        if main_content:
            # Find all the paragraph <p> tags within the main content
            paragraphs = main_content.find_all('p')
            # Join the text from all paragraphs together with a double newline
            article_text = '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
        
        if not article_text:
            # If we still didn't find text, raise an error so we know.
            raise ValueError("Selector failed to find article text paragraphs.")
        # ----------------------------------------

        print(f"Successfully extracted content for: {title}")

        # Return all the new data in our JSON response
        return jsonify({
            "status": "success",
            "received_url": url,
            "title": title,
            "author": author,
            "publish_date": publish_date,
            "article_text": article_text
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
        
    finally:
        if driver:
            driver.quit()

if __name__ == '__main__':
    app.run(debug=True)