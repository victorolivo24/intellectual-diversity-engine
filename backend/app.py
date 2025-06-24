# 1. All import statements
import datetime, json, os, re
from collections import Counter, defaultdict
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

# 2. Initial Setup
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 3. Database Models - Added 'category' column
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
    id = db.Column(db.Integer, primary_key=True); url = db.Column(db.String(500), unique=True, nullable=False); title = db.Column(db.String(500), nullable=False); article_text = db.Column(db.Text, nullable=False); retrieved_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.datetime.now(datetime.UTC)); sentiment_score = db.Column(db.Float, nullable=True); keywords = db.Column(db.JSON, nullable=True);
    category = db.Column(db.String(50), nullable=True) # NEW COLUMN

# 4. Token Decorator (no changes)
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

# 5. Helper Functions
def get_html(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15); response.raise_for_status()
        return response.text
    except requests.RequestException:
        driver = None;
        try:
            chrome_options = Options(); chrome_options.add_argument("--headless"); chrome_options.add_argument("--no-sandbox"); chrome_options.add_argument("--disable-dev-shm-usage")
            driver = webdriver.Chrome(service=Service(), options=chrome_options); driver.get(url); return driver.page_source
        finally:
            if driver: driver.quit()

def extract_article_text(soup):
    for tag in ['script', 'style', 'header', 'footer', 'nav', 'aside']:
        for s in soup.select(tag): s.decompose()
    return soup.get_text(separator='\n', strip=True)

# --- UPDATED: Gemini AI Analysis Function ---
def get_ai_analysis(text):
    print("--- Getting analysis from Gemini AI ---")
    max_chars = 15000 
    truncated_text = text[:max_chars]

    categories = ["Politics", "Technology", "Sports", "Business", "Entertainment", "Science", "Health", "World News", "Lifestyle", "Crime", "Other"]
    
    prompt = f"""
    Analyze the following news article text. Provide your analysis in a single, valid JSON object with three keys:
    1. "sentiment_score": A float from -1.0 (very negative) to 1.0 (very positive), assessing the overall tone.
    2. "keywords": A JSON array of the 5-7 most relevant, general, single-word keywords. These should be broad topics. Normalize them to their base form (e.g., "economy" not "economic", "politics" not "political").
    3. "category": A single string, choosing the ONE most fitting category for this article from the following list: {categories}
    Article Text: "{truncated_text}"
    """
    
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
    api_key = app.config['GEMINI_API_KEY']
    if not api_key: raise ValueError("GEMINI_API_KEY not set in environment.")
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
    
    try:
        response = requests.post(api_url, headers={'Content-Type': 'application/json'}, json=payload, timeout=45)
        response.raise_for_status(); result = response.json()
        content = result['candidates'][0]['content']['parts'][0]['text'].strip().replace('```json', '').replace('```', '')
        analysis = json.loads(content)
        return analysis.get('sentiment_score', 0.0), analysis.get('keywords', []), analysis.get('category', 'Other')
    except Exception as e:
        print(f"Error calling or parsing Gemini API: {e}"); return 0.0, [], "Error"

# 6. API Routes
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
    # ADDED 'id': a.id to the dictionary
    articles = [{'id': a.id, 'title': a.title, 'url': a.url, 'sentiment': a.sentiment_score, 'keywords': a.keywords, 'category': a.category} for a in current_user.articles]
    return jsonify(articles)

# --- NEW: Category Analysis Endpoint ---
@app.route('/category_analysis', methods=['GET'])
@token_required
def category_analysis(current_user):
    category_sentiments = defaultdict(lambda: {'total_score': 0, 'count': 0})
    for article in current_user.articles:
        if article.category and article.sentiment_score is not None:
            category_sentiments[article.category]['total_score'] += article.sentiment_score
            category_sentiments[article.category]['count'] += 1
    
    analysis_results = [{'category': cat, 'average_sentiment': data['total_score'] / data['count'], 'article_count': data['count']} for cat, data in category_sentiments.items() if data['count'] > 0]
    analysis_results.sort(key=lambda x: (-x['article_count'], x['category']))
    return jsonify(analysis_results)


@app.route('/analyze', methods=['POST'])
@token_required
def analyze(current_user):
    url = request.get_json().get('url')
    if not url: return jsonify({'message': 'URL is required'}), 400

    existing = Article.query.filter_by(url=url).first()
    if existing:
        if existing not in current_user.articles:
            current_user.articles.append(existing); db.session.commit()
        return jsonify({'message': 'Article added to history', 'data': {'title': existing.title, 'sentiment': existing.sentiment_score, 'keywords': existing.keywords, 'category': existing.category, 'article_text': existing.article_text }})

    try:
        html = get_html(url)
        if not html: raise ValueError("Could not retrieve HTML.")
        soup = BeautifulSoup(html, 'html.parser')
        
        title = soup.find('title').get_text(strip=True) or "No Title"
        text = extract_article_text(soup)
        if not text: raise ValueError("Could not extract meaningful text.")

        sentiment, keywords, category = get_ai_analysis(text)
        
        new_article = Article(url=url, title=title, article_text=text, sentiment_score=sentiment, keywords=keywords, category=category)
        db.session.add(new_article); current_user.articles.append(new_article); db.session.commit()
        
        return jsonify({'message': 'Article analyzed', 'data': {'title': title, 'sentiment': sentiment, 'keywords': keywords, 'category': category, 'article_text': text}})
    except Exception as e:
        db.session.rollback(); return jsonify({'message': str(e)}), 500

# 7. Main execution block
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000)
