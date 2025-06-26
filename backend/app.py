# 1. All import statements
import datetime, json, os, re, time
from collections import Counter, defaultdict
from functools import wraps
import requests
from urllib.parse import urlparse
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
import secrets
from datetime import timedelta, datetime, timezone

# 2. Initial Setup
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 3. Database Models
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
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    article_text = db.Column(db.Text, nullable=False)
    retrieved_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    sentiment_score = db.Column(db.Float, nullable=True) 
    keywords = db.Column(db.JSON, nullable=True)      
    category = db.Column(db.String(50), nullable=True)

class SsoTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket = db.Column(db.String(100), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)

class UserTopic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    __table_args__ = (db.UniqueConstraint('name', 'user_id', name='_user_topic_uc'),)

# 4. Token Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token: return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # Use the modern db.session.get() here as well
            current_user = db.session.get(User, data['id']) 
        except: return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated



def get_html(url):
    """
    Attempts to get HTML with a simple request first. If the content is too short
    (indicating a paywall or JS-loaded page), it falls back to using Selenium.
    """
    try:
        # First attempt with simple requests
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Check if the content is substantial enough
        temp_soup = BeautifulSoup(response.text, 'html.parser')
        temp_text = extract_article_text(temp_soup)
        print(f"--- Text content length from simple request: {len(temp_text)} ---")
        
        if len(temp_text) > 500: # We consider >500 characters a successful scrape
            print("--- Simple request successful with enough content. ---")
            return response.text
        
        print("--- Simple request got insufficient text. Falling back to Selenium. ---")

    except requests.RequestException as e:
        print(f"--- Simple request failed: {e}. Falling back to Selenium. ---")

    # Fallback to Selenium if the simple request fails OR returns too little content
    driver = None
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        print("--- Launching Selenium to get full page source. ---")
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        driver.get(url)
        time.sleep(3) # Wait 3 seconds for JavaScript to load content
        return driver.page_source
    finally:
        if driver:
            driver.quit()

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
    token = jwt.encode({'id': user.id, 'exp': datetime.utcnow() + timedelta(hours=24)}, app.config['SECRET_KEY'], "HS256")
    return jsonify({'token': token, 'username': user.username})

@app.route('/dashboard', methods=['GET'])
@token_required
def dashboard(current_user):
    # ADDED 'id': a.id to the dictionary
    articles = [{'id': a.id, 'title': a.title, 'url': a.url, 'sentiment': a.sentiment_score, 'keywords': a.keywords, 'category': a.category} for a in current_user.articles]
    return jsonify(articles)

@app.route('/move_article', methods=['POST'])
@token_required
def move_article(current_user):
    data = request.get_json()
    article_id = data.get('article_id')
    new_category = data.get('new_category')

    # Basic validation
    valid_categories = ["Politics", "Technology", "Sports", "Business", "Entertainment", "Science", "Health", "World News", "Lifestyle", "Crime", "Other"]
    if not article_id or not new_category or new_category not in valid_categories:
        return jsonify({'message': 'Invalid request data'}), 400

    article = Article.query.get(article_id)

    # Security check: ensure the article exists and belongs to the current user's reading list
    if not article or article not in current_user.articles:
        return jsonify({'message': 'Article not found or access denied'}), 404

    # Update the category and save to the database
    article.category = new_category
    db.session.commit()

    return jsonify({'message': f"Article '{article.title}' moved to '{new_category}' successfully."})

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

@app.route('/generate_sso_ticket', methods=['POST'])
@token_required
def generate_sso_ticket(current_user):
    """Generates a secure, single-use ticket for a logged-in user."""
    ticket_string = secrets.token_urlsafe(32)
    # Use utcnow() to create a naive datetime object in UTC
    expiration = datetime.utcnow() + timedelta(seconds=60)
    
    new_ticket = SsoTicket(
        ticket=ticket_string,
        user_id=current_user.id,
        expires_at=expiration
    )
    db.session.add(new_ticket)
    db.session.commit()
    
    return jsonify({'sso_ticket': ticket_string})


DEFAULT_TOPICS = ["Politics", "Technology", "Sports", "Business", "Entertainment", "Science", "Health", "World News", "Lifestyle", "Crime", "Other"]

@app.route('/topics', methods=['GET'])
@token_required
def get_topics(current_user):
    """Gets the full list of default and user-created topics."""
    custom_topics = [topic.name for topic in UserTopic.query.filter_by(user_id=current_user.id).all()]
    return jsonify({
        'default_topics': DEFAULT_TOPICS,
        'custom_topics': sorted(custom_topics)
    })

@app.route('/topics', methods=['POST'])
@token_required
def create_topic(current_user):
    """Creates a new custom topic for the user."""
    data = request.get_json()
    new_topic_name = data.get('name', '').strip()

    if not new_topic_name:
        return jsonify({'message': 'Topic name cannot be empty'}), 400
    if len(new_topic_name) > 50:
        return jsonify({'message': 'Topic name is too long'}), 400

    # Check if topic already exists (either as a default or custom topic)
    existing_custom = UserTopic.query.filter_by(user_id=current_user.id, name=new_topic_name).first()
    if new_topic_name in DEFAULT_TOPICS or existing_custom:
        return jsonify({'message': 'Topic already exists'}), 409

    topic = UserTopic(name=new_topic_name, user_id=current_user.id)
    db.session.add(topic)
    db.session.commit()
    return jsonify({'message': 'Topic created successfully'}), 201

@app.route('/topics/<string:topic_name>', methods=['DELETE'])
@token_required
def delete_topic(current_user, topic_name):
    """Deletes a custom topic, only if no articles are assigned to it."""
    if topic_name in DEFAULT_TOPICS:
        return jsonify({'message': 'Cannot delete a default topic'}), 403

    topic_to_delete = UserTopic.query.filter_by(user_id=current_user.id, name=topic_name).first()
    if not topic_to_delete:
        return jsonify({'message': 'Custom topic not found'}), 404

    # For safety, only allow deleting a topic if no articles are using it
    articles_in_topic = Article.query.filter(Article.readers.any(id=current_user.id), Article.category == topic_name).first()
    if articles_in_topic:
        return jsonify({'message': 'Cannot delete topic. Articles are still assigned to it.'}), 409

    db.session.delete(topic_to_delete)
    db.session.commit()
    return jsonify({'message': 'Topic deleted successfully'})

@app.route('/redeem_sso_ticket', methods=['POST'])
def redeem_sso_ticket():
    """Redeems a single-use ticket and returns a full JWT session token."""
    data = request.get_json()
    ticket_string = data.get('sso_ticket')

    if not ticket_string:
        return jsonify({'message': 'Ticket is missing'}), 400

    sso_ticket = SsoTicket.query.filter_by(ticket=ticket_string).first()
    
    # Use utcnow() for simple, naive UTC datetime comparison
    if not sso_ticket or sso_ticket.is_used or sso_ticket.expires_at < datetime.utcnow():
        return jsonify({'message': 'Invalid or expired ticket'}), 401
    
    # Mark ticket as used
    sso_ticket.is_used = True
    
    # Use the modern db.session.get() to avoid the legacy warning
    user = db.session.get(User, sso_ticket.user_id) 

    # --- THIS IS THE LINE WE ARE FIXING ---
    # Removed the incorrect 'datetime.' prefix before 'timedelta'
    token = jwt.encode(
        {'id': user.id, 'exp': datetime.utcnow() + timedelta(hours=24)},
        app.config['SECRET_KEY'],
        "HS256"
    )
    
    db.session.commit()

    return jsonify({'token': token, 'username': user.username})

@app.route('/source_analysis', methods=['GET'])
@token_required
def source_analysis(current_user):
    """Parses the domain from each article URL and returns a count for each."""
    # Using 'www.' prefix can lead to duplicates (e.g., www.cnn.com and cnn.com)
    # This logic cleans it up.
    domains = [
        urlparse(article.url).netloc.replace('www.', '') 
        for article in current_user.articles
    ]
    domain_counts = Counter(domains)
    
    # Sort by count descending, then by domain name alphabetically
    sorted_domains = sorted(domain_counts.items(), key=lambda item: (-item[1], item[0]))
    
    result = [{'domain': domain, 'count': count} for domain, count in sorted_domains]
    return jsonify(result)


@app.route('/sentiment_timeline', methods=['GET'])
@token_required
def sentiment_timeline(current_user):
    """Groups articles by date and calculates the average sentiment for each day."""
    daily_sentiments = defaultdict(list)
    
    for article in current_user.articles:
        # Group scores by date
        day = article.retrieved_at.strftime('%Y-%m-%d')
        daily_sentiments[day].append(article.sentiment_score)
        
    # Calculate the average for each day
    analysis_results = []
    for day, scores in daily_sentiments.items():
        if scores:
            average = sum(scores) / len(scores)
            analysis_results.append({'date': day, 'average_sentiment': average})
            
    # Sort by date
    analysis_results.sort(key=lambda item: item['date'])
    
    return jsonify(analysis_results)
# 7. Main execution block
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000,debug=True)
