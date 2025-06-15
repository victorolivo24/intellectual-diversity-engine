# 1. All import statements
import datetime
import json
import os
import re
from collections import Counter

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# NLTK Imports
import nltk
from nltk.corpus import stopwords
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# --- Initial Setup ---
load_dotenv()
app = Flask(__name__)
CORS(app)

# --- Database Configuration ---
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- NLTK Setup ---
try:
    sid = SentimentIntensityAnalyzer()
    stop_words = set(stopwords.words('english'))
except LookupError:
    print("NLTK data not found. Downloading...")
    nltk.download('vader_lexicon', quiet=True)
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
    sid = SentimentIntensityAnalyzer()
    stop_words = set(stopwords.words('english'))

# --- Database Models ---
class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    author = db.Column(db.String(200), nullable=True)
    publish_date = db.Column(db.String(100), nullable=True)
    article_text = db.Column(db.Text, nullable=False)
    retrieved_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow)
    sentiment_score = db.Column(db.Float, nullable=True)
    keywords = db.Column(db.JSON, nullable=True)

# --- Helper Functions ---
def get_sentiment(text):
    scores = sid.polarity_scores(text)
    return scores['compound']

def get_keywords(text, num_keywords=10):
    text = re.sub(r'[^\w\s]', '', text.lower())
    tokens = text.split()
    filtered_words = [word for word in tokens if word not in stop_words and len(word) > 2]
    word_counts = Counter(filtered_words)
    return [word for word, count in word_counts.most_common(num_keywords)]

# --- NEW: Systematic Waterfall Extraction Function ---
def extract_text_from_html(soup):
    """Tries a waterfall of strategies to find the main article text."""
    
    # Strategy 1: Look for JSON-LD script (Most reliable)
    script_tag = soup.find('script', type='application/ld+json')
    if script_tag:
        try:
            data = json.loads(script_tag.string)
            if isinstance(data, list): data = data[0]
            if data.get('@type') == 'NewsArticle' and data.get('articleBody'):
                print("Extraction Strategy: JSON-LD")
                return data['articleBody']
        except (json.JSONDecodeError, IndexError): pass

    # Strategy 2: Look for common article body class names
    common_classes = ['RichTextBody', 'article-body', 'story-content', 'main-content', 'entry-content', 'post-content']
    for class_name in common_classes:
        container = soup.find('div', class_=class_name)
        if container:
            print(f"Extraction Strategy: Common Class ('{class_name}')")
            paragraphs = container.find_all('p')
            return '\n\n'.join([p.get_text(strip=True) for p in paragraphs])

    # Strategy 3: Look for semantic HTML5 tags
    article_tag = soup.find('article')
    if article_tag:
        print("Extraction Strategy: <article> tag")
        paragraphs = article_tag.find_all('p')
        return '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
    
    main_tag = soup.find('main')
    if main_tag:
        print("Extraction Strategy: <main> tag")
        paragraphs = main_tag.find_all('p')
        return '\n\n'.join([p.get_text(strip=True) for p in paragraphs])

    return None

# --- API Routes ---
@app.route('/analyze', methods=['POST'])
def analyze_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400
    url = data['url']
    
    with app.app_context():
        existing_article = Article.query.filter_by(url=url).first()
        if existing_article:
            print(f"Article already in DB: {existing_article.title}")
            return jsonify({ "status": "success", "message": "Article already exists in database.", "data": { "title": existing_article.title, "author": existing_article.author, "publish_date": existing_article.publish_date, "article_text": existing_article.article_text, "sentiment": existing_article.sentiment_score, "keywords": existing_article.keywords } })

    driver = None
    try:
        chrome_options = Options(); chrome_options.add_argument("--headless"); chrome_options.add_argument("--no-sandbox"); chrome_options.add_argument("--disable-dev-shm-usage"); chrome_options.add_argument("--disable-gpu"); chrome_options.add_argument("--log-level=3"); chrome_options.add_argument("--disable-blink-features=AutomationControlled"); chrome_options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"]); chrome_options.add_experimental_option('useAutomationExtension', False)
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'})
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        html = driver.page_source
        
        soup = BeautifulSoup(html, 'html.parser')
        
        title = soup.find('title').get_text() if soup.find('title') else "No title found"
        author = "No author found"
        publish_date = None
        author_tag = soup.find('meta', property='article:author');
        if author_tag: author = author_tag['content']
        date_tag = soup.find('meta', property='article:published_time');
        if date_tag: publish_date = date_tag['content']
        if author == "No author found" or not publish_date:
            script_tag = soup.find('script', type='application/ld+json')
            if script_tag:
                try:
                    data = json.loads(script_tag.string);
                    if isinstance(data, list): data = data[0]
                    if author == "No author found" and data.get('author'):
                        author_data = data['author'];
                        if isinstance(author_data, list): author_data = author_data[0]
                        if author_data.get('name'): author = author_data['name']
                    if not publish_date and data.get('datePublished'): publish_date = data['datePublished']
                except (json.JSONDecodeError, IndexError): pass
        
        article_text = extract_text_from_html(soup)
        if not article_text: raise ValueError("Failed to extract article text using all available strategies.")
        
        sentiment_score = get_sentiment(article_text)
        keywords = get_keywords(article_text)
        
        with app.app_context():
            new_article = Article( url=url, title=title, author=author, publish_date=publish_date, article_text=article_text, sentiment_score=sentiment_score, keywords=keywords )
            db.session.add(new_article)
            db.session.commit()
            return jsonify({ "status": "success", "message": "New article scraped and saved.", "data": { "title": title, "author": author, "publish_date": publish_date, "article_text": article_text, "sentiment": sentiment_score, "keywords": keywords } })
    except Exception as e:
        print(f"An error occurred: {e}")
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if driver: driver.quit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all() 
    app.run(debug=True)
