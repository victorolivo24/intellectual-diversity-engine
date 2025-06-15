# 1. All import statements go at the very top.
import datetime
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
from dotenv import load_dotenv
from flask_cors import CORS

load_dotenv()

# 2. Create the Flask app instance. This MUST happen after imports and before routes.
app = Flask(__name__)
CORS(app)
# 3. Configure the app.
# IMPORTANT: Replace YOUR_PASSWORD with the password you set for the 'postgres' user.
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 4. Define your database models.
class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    author = db.Column(db.String(200))
    publish_date = db.Column(db.String(100))
    article_text = db.Column(db.Text, nullable=False)
    retrieved_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)

    def __repr__(self):
        return f'<Article {self.title}>'

# 5. Define your routes. Now it's safe to use @app.route because 'app' exists.
@app.route('/')
def index():
    return "The Echo Escape server is running."

@app.route('/analyze', methods=['POST'])
def analyze_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400

    url = data['url']
    
    # Check if the article already exists in the database
    existing_article = Article.query.filter_by(url=url).first()
    if existing_article:
        print(f"Article already in DB: {existing_article.title}")
        return jsonify({
            "status": "success", 
            "message": "Article already exists in database.",
            "data": {
                "title": existing_article.title,
                "author": existing_article.author,
                "publish_date": existing_article.publish_date
            }
        })

    print(f"New URL. Starting scraping for: {url}")
    
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
        
        # Wait for the main headline to ensure the page is loaded
        WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))

        html = driver.page_source
        
        soup = BeautifulSoup(html, 'html.parser')
        
        # --- PARSING WITH BEAUTIFUL SOUP ---
        title_tag = soup.find('title')
        title = title_tag.get_text() if title_tag else "No title found"
        
        author_tag = soup.find('meta', property='article:author')
        author = author_tag['content'] if author_tag else "No author found"
        
        date_tag = soup.find('meta', property='article:published_time')
        publish_date = date_tag['content'] if date_tag else None
        
        # This uses the correct class name you found in the debug file
        article_body_div = soup.find('div', class_='RichTextStoryBody')
        
        article_text = "No article text found"
        if article_body_div:
            paragraphs = article_body_div.find_all('p')
            article_text = '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
        # --------------------------------

        if not title or not article_text or article_text == "No article text found":
             raise ValueError("Failed to extract title or text from the page.")
        
        # Save the complete, scraped article to the database
        new_article = Article(
            url=url,
            title=title,
            author=author,
            publish_date=publish_date,
            article_text=article_text
        )
        db.session.add(new_article)
        db.session.commit()
        print(f"SUCCESS: Saved '{title}' to database.")

        return jsonify({
            "status": "success",
            "message": "New article scraped and saved.",
            "data": {
                "title": title,
                "author": author,
                "publish_date": publish_date,
                "article_text": article_text
            }
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        db.session.rollback() # Rollback the transaction on error
        return jsonify({"status": "error", "message": str(e)}), 500
        
    finally:
        if driver:
            driver.quit()

# 6. Run the app (this should always be at the very bottom of the file).
if __name__ == '__main__':
    app.run(debug=True)

