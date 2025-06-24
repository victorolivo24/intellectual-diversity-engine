import datetime, json, os, re
from collections import Counter
from functools import wraps
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

# --- Initial Setup ---
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY') # Load Gemini Key
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Database Models ---
reading_list = db.Table('reading_list',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('article_id', db.Integer, db.ForeignKey('article.id'), primary_key=True)
)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True); username = db.Column(db.String(80), unique=True, nullable=False); password_hash = db.Column(db.String(256), nullable=False)
    articles = db.relationship('Article', secondary=reading_list, backref=db.backref('readers', lazy=True))
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True); url = db.Column(db.String(500), unique=True, nullable=False); title = db.Column(db.String(500), nullable=False); author = db.Column(db.String(200), nullable=True); publish_date = db.Column(db.String(100), nullable=True); article_text = db.Column(db.Text, nullable=False); retrieved_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC)); sentiment_score = db.Column(db.Float, nullable=True); keywords = db.Column(db.JSON, nullable=True)

# --- Token Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token: return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"]); current_user = User.query.get(data['id'])
        except: return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- Helper Functions ---
def get_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return response.text
    except requests.RequestException:
        driver = None
        try:
            chrome_options = Options(); chrome_options.add_argument("--headless"); chrome_options.add_argument("--no-sandbox"); chrome_options.add_argument("--disable-dev-shm-usage")
            driver = webdriver.Chrome(service=Service(), options=chrome_options)
            driver.get(url); return driver.page_source
        finally:
            if driver: driver.quit()

def extract_metadata(soup):
    title = soup.find('title').get_text(strip=True) if soup.find('title') else "No Title Found"
    author, publish_date = "No Author Found", None
    # (Extraction logic remains the same)
    return title, author, publish_date
    
def extract_article_text(soup):
    for tag in ['script', 'style', 'header', 'footer', 'nav', 'aside']:
        for s in soup.select(tag): s.decompose() if s else None
    strategies = [{'selector': 'div', 'class_': 'article-content'}, {'selector': 'div', 'class_': 'story-body'}, {'selector': 'div', 'class_': 'article__body'}, {'selector': 'div', 'class_': 'RichTextBody'}, {'selector': 'section', 'attrs': {'name': 'articleBody'}}, {'selector': 'article', 'class_': None}]
    for strategy in strategies:
        container = soup.find(strategy['selector'], class_=strategy.get('class_'), attrs=strategy.get('attrs'))
        if container:
            text = '\n\n'.join([p.get_text(strip=True) for p in container.find_all('p', recursive=True)])
            if len(text) > 200: return text
    return soup.get_text(separator='\n', strip=True)

def get_ai_analysis(text):
    print("--- Getting analysis from Gemini AI ---")
    max_chars = 15000 
    truncated_text = text[:max_chars]

    prompt = f"""Analyze the following news article text. Provide your analysis in a valid JSON format.
    1. "sentiment_score": A single float between -1.0 (extremely negative) and 1.0 (extremely positive), assessing the overall tone and context.
    2. "keywords": A JSON array of the 10 most relevant and specific keywords or key phrases (2-3 words). Do not include generic or uninformative words.
    Article Text: "{truncated_text}"
    """
    
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    api_key = app.config['GEMINI_API_KEY'] # Use the key from app config
    if not api_key: raise ValueError("GEMINI_API_KEY not set in environment.")
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    try:
        response = requests.post(api_url, headers={'Content-Type': 'application/json'}, json=payload, timeout=45)
        response.raise_for_status()
        result = response.json()
        content_text = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
        cleaned_text = content_text.strip().replace('```json', '').replace('```', '')
        analysis = json.loads(cleaned_text)
        return analysis.get('sentiment_score', 0.0), analysis.get('keywords', [])
    except Exception as e:
        print(f"Error calling or parsing Gemini API: {e}")
        return 0.0, []

# --- API Routes ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(); u, p = data.get('username'), data.get('password')
    if not u or not p: return jsonify({'message': 'Username and password required'}), 400
    if User.query.filter_by(username=u).first(): return jsonify({'message': 'Username already exists'}), 400
    user = User(username=u); user.set_password(p); db.session.add(user); db.session.commit()
    return jsonify({'message': 'User registered successfully'})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(); u, p = data.get('username'), data.get('password')
    user = User.query.filter_by(username=u).first()
    if not user or not user.check_password(p): return jsonify({'message': 'Invalid credentials'}), 401
    token = jwt.encode({'id': user.id, 'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], "HS256")
    return jsonify({'token': token, 'username': user.username})

@app.route('/dashboard', methods=['GET'])
@token_required
def dashboard(current_user):
    articles = [{'title': a.title, 'url': a.url, 'sentiment': a.sentiment_score, 'keywords': a.keywords} for a in current_user.articles]
    return jsonify(articles)

# --- CORRECTED analyze route ---
@app.route('/analyze', methods=['POST'])
@token_required
def analyze(current_user):
    url = request.get_json().get('url')
    if not url: return jsonify({'message': 'URL is required'}), 400

    try:
        # Check for existing article first
        existing_article = Article.query.filter_by(url=url).first()
        if existing_article:
            if existing_article not in current_user.articles:
                current_user.articles.append(existing_article)
                db.session.commit()
            print(f"Article '{existing_article.title}' already in DB. Added to user's history.")
            return jsonify({'message': 'Article already exists and has been added to your reading list.', 'data': {'title': existing_article.title, 'sentiment': existing_article.sentiment_score, 'keywords': existing_article.keywords, 'article_text': existing_article.article_text}})

        # If not existing, proceed to scrape
        html = get_html(url)
        if not html: raise ValueError("Could not retrieve HTML from URL.")
        soup = BeautifulSoup(html, 'html.parser')
        
        title, author, publish_date = extract_metadata(soup)
        article_text = extract_article_text(soup)
        if not article_text: raise ValueError("Could not extract meaningful article text.")

        sentiment, keywords = get_ai_analysis(article_text)
        
        new_article = Article(url=url, title=title, author=author, publish_date=publish_date, article_text=article_text, sentiment_score=sentiment, keywords=keywords)
        db.session.add(new_article)
        # Important: Link to user before committing
        current_user.articles.append(new_article)
        db.session.commit()
        
        print(f"SUCCESS: Analyzed and saved new article '{title}' for user '{current_user.username}'")
        return jsonify({'message': 'Article analyzed and saved to your history.', 'data': {'title': title, 'author': author, 'publish_date': publish_date, 'article_text': article_text, 'sentiment': sentiment, 'keywords': keywords}})
    
    except Exception as e:
        db.session.rollback()
        print(f"An error occurred in /analyze: {e}")
        return jsonify({'message': str(e)}), 500

# Main execution block
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000)
