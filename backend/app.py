# 1. All import statements
import datetime
import json
import os
import re
from collections import Counter
from functools import wraps

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

import jwt

import nltk
from nltk.corpus import stopwords
from nltk.sentiment.vader import SentimentIntensityAnalyzer

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

# --- Database and App Configuration ---
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- NLTK Setup ---
try:
    sid = SentimentIntensityAnalyzer()
    stop_words = set(stopwords.words('english'))
except LookupError:
    nltk.download('vader_lexicon', quiet=True); nltk.download('stopwords', quiet=True)
    sid = SentimentIntensityAnalyzer(); stop_words = set(stopwords.words('english'))

# --- Database Models ---
reading_list = db.Table('reading_list',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('article_id', db.Integer, db.ForeignKey('article.id'), primary_key=True)
)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    articles = db.relationship('Article', secondary=reading_list, backref=db.backref('readers', lazy=True))
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True); url = db.Column(db.String(500), unique=True, nullable=False); title = db.Column(db.String(500), nullable=False); author = db.Column(db.String(200), nullable=True); publish_date = db.Column(db.String(100), nullable=True); article_text = db.Column(db.Text, nullable=False); retrieved_at = db.Column(db.DateTime, nullable=False, default=datetime.datetime.utcnow); sentiment_score = db.Column(db.Float, nullable=True); keywords = db.Column(db.JSON, nullable=True)

# --- Token Required Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['id'])
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- Helper Functions ---
def get_sentiment(text): return sid.polarity_scores(text)['compound']
def get_keywords(text, num_keywords=10):
    text = re.sub(r'[^\w\s]', '', text.lower()); tokens = text.split()
    filtered_words = [word for word in tokens if word not in stop_words and len(word) > 2]
    return [word for word, count in Counter(filtered_words).most_common(num_keywords)]
def extract_text_from_html(soup):
    strategies = [
        lambda s: s.find('div', class_='RichTextBody'),
        lambda s: s.find('script', type='application/ld+json'),
        lambda s: s.find('article')
    ]
    for i, strategy_func in enumerate(strategies):
        container = strategy_func(soup)
        if not container: continue
        if container.name == 'script':
            try:
                data = json.loads(container.string)
                if isinstance(data, list): data = data[0]
                if data.get('@type') == 'NewsArticle' and data.get('articleBody'): return data['articleBody']
            except (json.JSONDecodeError, IndexError, TypeError): continue
        else:
            paragraphs = container.find_all('p')
            if paragraphs: return '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
    return None

# --- API Routes ---
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Could not verify'}), 401
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid username or password'}), 401
    token = jwt.encode({'id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], "HS256")
    return jsonify({'token': token, 'username': user.username})

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json();
    if not data or not data.get('username') or not data.get('password'): return jsonify({"status": "error", "message": "Username and password required."}), 400
    if User.query.filter_by(username=data['username']).first(): return jsonify({"status": "error", "message": "Username already exists."}), 400
    user = User(username=data['username']); user.set_password(data['password'])
    db.session.add(user); db.session.commit()
    return jsonify({"status": "success", "message": "User registered."})

# --- NEW: Dashboard Data Endpoint ---
@app.route('/dashboard', methods=['GET'])
@token_required
def get_dashboard_data(current_user):
    articles_data = []
    for article in current_user.articles:
        articles_data.append({
            "title": article.title,
            "url": article.url,
            "author": article.author,
            "sentiment": article.sentiment_score,
            "keywords": article.keywords
        })
    return jsonify({"status": "success", "data": articles_data})
# ------------------------------------

@app.route('/analyze', methods=['POST'])
@token_required
def analyze_url(current_user):
    data = request.get_json()
    if not data or 'url' not in data: return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400
    url = data['url']
    
    existing_article = Article.query.filter_by(url=url).first()
    if existing_article:
        if existing_article not in current_user.articles:
            current_user.articles.append(existing_article)
            db.session.commit()
        return jsonify({ "status": "success", "message": "Article already exists and has been added to your reading list.", "data": { "title": existing_article.title, "author": existing_article.author, "publish_date": existing_article.publish_date, "article_text": existing_article.article_text, "sentiment": existing_article.sentiment_score, "keywords": existing_article.keywords } })

    driver = None
    try:
        chrome_options = Options(); chrome_options.add_argument("--headless"); chrome_options.add_argument("--no-sandbox"); chrome_options.add_argument("--disable-dev-shm-usage"); chrome_options.add_argument("--disable-gpu"); chrome_options.add_argument("--log-level=3"); chrome_options.add_argument("--disable-blink-features=AutomationControlled"); chrome_options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"]); chrome_options.add_experimental_option('useAutomationExtension', False)
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'})
        driver.get(url); WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
        html = driver.page_source
        
        soup = BeautifulSoup(html, 'html.parser')
        
        title = soup.find('title').get_text(strip=True) if soup.find('title') else "No Title Found"
        author, publish_date = "No Author Found", None
        meta_author = soup.find('meta', property='article:author');
        if meta_author: author = meta_author['content']
        meta_date = soup.find('meta', property='article:published_time');
        if meta_date: publish_date = meta_date['content']
        if author == "No Author Found" or not publish_date:
            script_tag = soup.find('script', type='application/ld+json')
            if script_tag:
                try:
                    data = json.loads(script_tag.string);
                    if isinstance(data, list): data = data[0]
                    if author == "No Author Found" and data.get('author'):
                        author_data = data['author'];
                        if isinstance(author_data, list): author_data = author_data[0]
                        if author_data.get('name'): author = author_data['name']
                    if not publish_date and data.get('datePublished'): publish_date = data['datePublished']
                except (json.JSONDecodeError, IndexError): pass
        
        article_text = extract_text_from_html(soup)
        if not article_text: raise ValueError("Failed to extract article text.")
        
        sentiment_score = get_sentiment(article_text); keywords = get_keywords(article_text)
        
        new_article = Article( url=url, title=title, author=author, publish_date=publish_date, article_text=article_text, sentiment_score=sentiment_score, keywords=keywords )
        db.session.add(new_article)
        current_user.articles.append(new_article)
        db.session.commit()
        return jsonify({ "status": "success", "message": "New article scraped and saved.", "data": { "title": title, "author": author, "publish_date": publish_date, "article_text": article_text, "sentiment": sentiment_score, "keywords": keywords } })
    except Exception as e:
        print(f"An error occurred: {e}"); db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if driver: driver.quit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all() 
    app.run(debug=True)
