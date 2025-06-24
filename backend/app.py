# 1. All import statements
import datetime
import json
import os
import re
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
import nltk
from nltk.corpus import stopwords
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

# 2. Initial Setup
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 3. NLTK Setup
try:
    sid = SentimentIntensityAnalyzer()
    custom_stopwords = {'said', 'also', 'would', 'could', 'like', 'one', 'two', 'us', 'new', 'get', 'year', 'told', 'ap', 'says', 'mr'}
    stop_words = set(stopwords.words('english')).union(custom_stopwords)
except LookupError:
    nltk.download('vader_lexicon', quiet=True); nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)
    sid = SentimentIntensityAnalyzer()
    stop_words = set(stopwords.words('english')).union(custom_stopwords)

# 4. Database Models
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

# 5. Token Decorator
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

# 6. Helper Functions
def get_sentiment(text): return sid.polarity_scores(text)['compound']
def get_keywords(text, n=10):
    words = re.findall(r'\b\w+\b', text.lower())
    filtered = [w for w in words if w not in stop_words and len(w) > 2]
    return [word for word, count in Counter(filtered).most_common(n)]

def get_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        print("Fast request successful.")
        return response.text
    except requests.RequestException as e:
        print(f"Fast request failed: {e}. Falling back to Selenium...")
        driver = None
        try:
            chrome_options = Options(); chrome_options.add_argument("--headless"); chrome_options.add_argument("--no-sandbox"); chrome_options.add_argument("--disable-dev-shm-usage")
            driver = webdriver.Chrome(service=Service(), options=chrome_options)
            driver.get(url); return driver.page_source
        finally:
            if driver: driver.quit()

def extract_metadata(soup):
    title = soup.find('title').get_text(strip=True) or "No Title Found"
    author, publish_date = "No Author Found", None
    
    # Meta tags
    meta_author = soup.find('meta', property='article:author')
    if meta_author: author = meta_author['content']
    meta_date = soup.find('meta', property='article:published_time')
    if meta_date: publish_date = meta_date['content']
    
    # JSON-LD
    if author == "No Author Found" or not publish_date:
        script_tag = soup.find('script', type='application/ld+json')
        if script_tag:
            try:
                data = json.loads(script_tag.string)
                if isinstance(data, list): data = data[0]
                if author == "No Author Found" and data.get('author'):
                    author_data = data['author']
                    if isinstance(author_data, list): author_data = author_data[0]
                    if isinstance(author_data, dict) and author_data.get('name'): author = author_data['name']
                if not publish_date and data.get('datePublished'): publish_date = data['datePublished']
            except (json.JSONDecodeError, IndexError, TypeError): pass
            
    return title, author, publish_date
    
def extract_article_text(soup):
    """Tries a waterfall of strategies to find the main article text."""
    for tag in ['script', 'style', 'header', 'footer', 'nav', 'aside']:
        for s in soup.select(tag): s.decompose()
    
    strategies = [
        {'name': 'article content', 'selector': 'div', 'class_': 'article-content'},
        {'name': 'story body', 'selector': 'div', 'class_': 'story-body'},
        {'name': 'article body', 'selector': 'div', 'class_': 'article__body'},
        {'name': 'AP News', 'selector': 'div', 'class_': 'ArticleBody'},
        {'name': 'NYT Story', 'selector': 'section', 'attrs': {'name': 'articleBody'}},
        {'name': 'generic article tag', 'selector': 'article', 'class_': None}
    ]
    
    for strategy in strategies:
        container = soup.find(strategy['selector'], class_=strategy.get('class_'), attrs=strategy.get('attrs'))
        if container:
            print(f"Found text using strategy: {strategy['name']}")
            paragraphs = container.find_all('p', recursive=True)
            text = '\n\n'.join([p.get_text(strip=True) for p in paragraphs])
            if text and len(text) > 200: # Simple check for meaningful content
                return text
    
    print("All strategies failed. Falling back to simple text extraction.")
    return soup.get_text(separator='\n', strip=True)

# 7. API Routes
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json(); u, p = data.get('username'), data.get('password')
    if not u or not p: return jsonify({'message': 'Username and password required'}), 400
    if User.query.filter_by(username=u).first(): return jsonify({'message': 'Username already exists'}), 400
    new_user = User(username=u); new_user.set_password(p); db.session.add(new_user); db.session.commit()
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

@app.route('/analyze', methods=['POST'])
@token_required
def analyze(current_user):
    url = request.get_json().get('url')
    if not url: return jsonify({'message': 'URL is required'}), 400

    existing = Article.query.filter_by(url=url).first()
    if existing:
        if existing not in current_user.articles:
            current_user.articles.append(existing); db.session.commit()
        return jsonify({'message': 'Article added to your history', 'data': {'title': existing.title, 'sentiment': existing.sentiment_score, 'keywords': existing.keywords, 'article_text': existing.article_text}})

    try:
        html = get_html(url)
        if not html: raise ValueError("Could not retrieve HTML from URL.")
        soup = BeautifulSoup(html, 'html.parser')
        
        title, author, publish_date = extract_metadata(soup)
        article_text = extract_article_text(soup)
        if not article_text: raise ValueError("Could not extract meaningful article text.")

        sentiment = get_sentiment(article_text); keywords = get_keywords(article_text)
        
        new_article = Article(url=url, title=title, author=author, publish_date=publish_date, article_text=article_text, sentiment_score=sentiment, keywords=keywords)
        db.session.add(new_article); current_user.articles.append(new_article); db.session.commit()
        
        return jsonify({'message': 'Article analyzed', 'data': {'title': title, 'author': author, 'publish_date': publish_date, 'article_text': article_text, 'sentiment': sentiment, 'keywords': keywords}})
    except Exception as e:
        db.session.rollback(); return jsonify({'message': str(e)}), 500

# 8. Main execution block
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000)
