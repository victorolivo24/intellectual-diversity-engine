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

# NEW: Import JWT library
import jwt

# NLTK Imports
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

# --- Database Models (no changes needed here) ---
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

# --- NEW: Token Required Decorator ---
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

# --- Helper Functions (no changes needed) ---
def get_sentiment(text): return sid.polarity_scores(text)['compound']
def get_keywords(text, num_keywords=10):
    text = re.sub(r'[^\w\s]', '', text.lower()); tokens = text.split()
    filtered_words = [word for word in tokens if word not in stop_words and len(word) > 2]
    return [word for word, count in Counter(filtered_words).most_common(num_keywords)]
def extract_text_from_html(soup):
    # (function content is the same)
    pass

# --- API Routes ---
@app.route('/login', methods=['POST'])
def login():
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return jsonify({'message': 'Could not verify'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}
    
    user = User.query.filter_by(username=auth.username).first()
    if not user:
        return jsonify({'message': 'User not found'}), 401

    if user.check_password(auth.password):
        token = jwt.encode({'id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'], "HS256")
        return jsonify({'token': token})

    return jsonify({'message': 'Could not verify'}), 401, {'WWW-Authenticate': 'Basic realm="Login required!"'}

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json();
    if not data or not data.get('username') or not data.get('password'): return jsonify({"status": "error", "message": "Username and password required."}), 400
    if User.query.filter_by(username=data['username']).first(): return jsonify({"status": "error", "message": "Username already exists."}), 400
    user = User(username=data['username']); user.set_password(data['password'])
    db.session.add(user); db.session.commit()
    return jsonify({"status": "success", "message": "User registered."})

# --- UPDATED: /analyze now uses the @token_required decorator ---
@app.route('/analyze', methods=['POST'])
@token_required
def analyze_url(current_user):
    # ...(Full logic will be pasted in the next step)...
    pass

# Paste the full, final versions of these functions below
def full_extract_text_from_html(soup):
    # ... same as before
    pass
def full_analyze_url(current_user):
    # ... logic updated to associate with current_user
    pass

# Final app execution
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)

