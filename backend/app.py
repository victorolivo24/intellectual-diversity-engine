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
import nltk
from nltk.corpus import stopwords
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

# Initial Setup
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# NLTK Setup
try:
    sid = SentimentIntensityAnalyzer()
    custom_stopwords = {'said', 'also', 'would', 'could', 'like', 'one', 'two', 'us', 'new', 'get', 'year', 'told', 'ap'}
    stop_words = set(stopwords.words('english')).union(custom_stopwords)
except LookupError:
    nltk.download('vader_lexicon', quiet=True)
    nltk.download('stopwords', quiet=True)
    nltk.download('punkt', quiet=True)
    sid = SentimentIntensityAnalyzer()
    stop_words = set(stopwords.words('english')).union(custom_stopwords)

# DB Models
reading_list = db.Table('reading_list',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('article_id', db.Integer, db.ForeignKey('article.id'), primary_key=True)
)
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    articles = db.relationship('Article', secondary=reading_list, backref=db.backref('readers', lazy=True))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

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

# Token Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['id'])
        except:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Helper Functions

def get_sentiment(text):
    return sid.polarity_scores(text)['compound']

def get_keywords(text, n=10):
    words = re.findall(r'\b\w+\b', text.lower())
    filtered = [w for w in words if w not in stop_words and len(w) > 2]
    return [word for word, count in Counter(filtered).most_common(n)]

def get_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        try:
            driver.get(url)
            return driver.page_source
        finally:
            driver.quit()

# API Routes
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Username and password required'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    user = User(username=data['username'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'User registered successfully'})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if not user or not user.check_password(data.get('password')):
        return jsonify({'message': 'Invalid credentials'}), 401
    token = jwt.encode({'id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], algorithm="HS256")
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
    if not url:
        return jsonify({'message': 'URL is required'}), 400

    # Check existing
    existing = Article.query.filter_by(url=url).first()
    if existing:
        if existing not in current_user.articles:
            current_user.articles.append(existing)
            db.session.commit()
        return jsonify({'message': 'Article added to history', 'data': {
            'title': existing.title, 'sentiment': existing.sentiment_score, 'keywords': existing.keywords
        }})

    try:
        html = get_html(url)
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.find('title').get_text(strip=True) or ''
        # If blocked by bot, override title
        if 'Access to this page has been denied' in title:
            title = url

        # Extract paragraphs
        paragraphs = [p.get_text(strip=True) for p in soup.find_all('p')]
        text = '\n\n'.join(paragraphs)
        if not text:
            return jsonify({'message': 'No article text found'}), 500

        sentiment = get_sentiment(text)
        keywords = get_keywords(text)

        article = Article(url=url, title=title, article_text=text, sentiment_score=sentiment, keywords=keywords)
        db.session.add(article)
        current_user.articles.append(article)
        db.session.commit()

        return jsonify({'message': 'Article analyzed', 'data': {
            'title': title, 'sentiment': sentiment, 'keywords': keywords
        }})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    # Ensure tables are created within application context
    with app.app_context():
        db.create_all()
    # Start the Flask application
    app.run(port=5000)
