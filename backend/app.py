# 1. All import statements
import datetime as dt
import json, os, re, time
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
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import secrets
import threading
from transformers import pipeline
import nltk
from nltk.corpus import stopwords

# 2. Initial Setup
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

try:
    stopwords.words("english")
except LookupError:
    nltk.download("stopwords")


# Lazy-load the ML model to keep shell commands fast
sentiment_pipeline = None
pipeline_lock = threading.Lock()

# 3. Database Models
reading_list = db.Table(
    "reading_list",
    db.Column("user_id", db.Integer, db.ForeignKey("user.id"), primary_key=True),
    db.Column("article_id", db.Integer, db.ForeignKey("article.id"), primary_key=True),
)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    articles = db.relationship(
        "Article", secondary=reading_list, backref=db.backref("readers", lazy=True)
    )
    refresh_token = db.Column(db.String(128), unique=True, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    article_text = db.Column(db.Text, nullable=False)
    retrieved_at = db.Column(
        db.DateTime, nullable=False, default=dt.datetime.utcnow
    )  # Corrected
    sentiment_score = db.Column(db.Float, nullable=True)
    keywords = db.Column(db.JSON, nullable=True)
    category = db.Column(db.String(50), nullable=True)


class SsoTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket = db.Column(db.String(100), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)


class UserTopic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("name", "user_id", name="_user_topic_uc"),)


# 4. Token Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("x-access-token")
        if not token:
            return jsonify({"message": "Token is missing!"}), 401
        try:
            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            current_user = db.session.get(User, data["id"])
        except:
            return jsonify({"message": "Token is invalid!"}), 401
        return f(current_user, *args, **kwargs)

    return decorated


# 5. Helper Functions
DEFAULT_TOPICS = [
    "Politics",
    "Technology",
    "Sports",
    "Business",
    "Entertainment",
    "Science",
    "Health",
    "World News",
    "Lifestyle",
    "Crime",
    "Other",
]


def get_html(url):
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        temp_soup = BeautifulSoup(response.text, "html.parser")
        temp_text = extract_article_text(temp_soup, url=url)
        if len(temp_text) > 250:
            return response.text
    except requests.RequestException as e:
        print(f"--- Simple request failed: {e}. Falling back to Selenium. ---")

    driver = None
    try:
        print("--- Launching Selenium fallback ---")
        options = Options()
        options.add_argument("--headless")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        driver = webdriver.Chrome(service=Service(), options=options)
        driver.get(url)
        WebDriverWait(driver, 8).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "article,body"))
        )
        time.sleep(2)
        return driver.page_source
    finally:
        if driver:
            driver.quit()


def extract_article_text(soup, url=None):
    # Remove irrelevant tags
    for tag in [
        "script",
        "style",
        "header",
        "footer",
        "nav",
        "aside",
        "form",
        "noscript",
    ]:
        for s in soup.select(tag):
            s.decompose()

    # Primary selectors that often contain article content
    selectors = [
        "article",
        "[role='main']",
        "#main",
        "#main-content",
        ".main-content",
        ".article-body",
        ".entry-content",
        ".post-content",
        ".post-body",
        ".story-body",
        ".content__article-body",
    ]

    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(separator="\n", strip=True)
            if len(text) > 250:
                return text

    # 🔍 Fallback 1: Try longest <div> block
    divs = soup.find_all("div")
    div_texts = [
        div.get_text(separator="\n", strip=True)
        for div in divs
        if div and div.get_text(strip=True)
    ]
    if div_texts:
        longest = max(div_texts, key=len)
        if len(longest) > 250:
            return longest

    # 🔍 Fallback 2: Try concatenated <p> tags
    paragraphs = soup.find_all("p")
    combined = "\n".join([p.get_text(strip=True) for p in paragraphs])
    if len(combined) > 250:
        return combined

    # 🧵 Final fallback: everything (already cleaned)
    return soup.get_text(separator="\n", strip=True)


def get_sentiment_pipeline():
    """Initializes and returns the sentiment analysis pipeline using a thread-safe lock."""
    global sentiment_pipeline
    with pipeline_lock:
        if sentiment_pipeline is None:
            print(
                "--- First request: Loading custom sentiment model... ---", flush=True
            )
            model_path = "./out-of-the-loop-production-model"
            sentiment_pipeline = pipeline(
                "sentiment-analysis", model=model_path, tokenizer=model_path
            )
            print("--- Sentiment model loaded successfully. ---", flush=True)
    return sentiment_pipeline


def get_local_analysis(text):
    """Analyzes text using the local fine-tuned model and improved keyword logic."""
    print("--- Getting analysis from local model... ---", flush=True)
    pipeline = get_sentiment_pipeline()

    result = pipeline(text[:512])[0]
    raw_score = result["score"]
    sentiment_score = (raw_score * 2) - 1
    sentiment_score = max(-1.0, min(1.0, sentiment_score))

    # --- UPGRADED KEYWORD LOGIC ---
    # Use NLTK's comprehensive list of English stop words
    stop_words = set(stopwords.words("english"))
    words = [
        word
        for word in re.findall(r"\b\w+\b", text.lower())
        if word not in stop_words and len(word) > 3 and not word.isdigit()
    ]
    keywords = [word for word, _ in Counter(words).most_common(7)]
    category = "General"

    return sentiment_score, keywords, category


# 6. API Routes
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    u, p = data.get("username"), data.get("password")
    if not u or not p:
        return jsonify({"message": "Username and password required"}), 400
    if User.query.filter_by(username=u).first():
        return jsonify({"message": "Username already exists"}), 400
    user = User(username=u)
    user.set_password(p)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    u, p = data.get("username"), data.get("password")
    user = User.query.filter_by(username=u).first()
    if not user or not user.check_password(p):
        return jsonify({"message": "Invalid credentials"}), 401
    token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=24)},
        app.config["SECRET_KEY"],
        "HS256",
    )
    refresh_token = secrets.token_urlsafe(64)
    user.refresh_token = refresh_token
    db.session.commit()
    return jsonify(
        {"token": token, "refresh_token": refresh_token, "username": user.username}
    )


@app.route('/analyze', methods=['POST'])
@token_required
def analyze(current_user):
    url = request.get_json().get('url')
    if not url: return jsonify({'message': 'URL is required'}), 400
    existing = Article.query.filter_by(url=url).first()
    if existing:
        if existing not in current_user.articles:
            current_user.articles.append(existing); db.session.commit()
        return jsonify({'message': 'Article added to history', 'data': {'title': existing.title, 'sentiment': existing.sentiment_score, 'keywords': existing.keywords, 'category': existing.category }})
    try:
        html = get_html(url)
        if not html: raise ValueError("Could not retrieve HTML.")
        soup = BeautifulSoup(html, 'html.parser')
        title = soup.find("title").get_text(strip=True) if soup.find("title") else "No Title"
        text = extract_article_text(soup, url=url)
        if not text or len(text.strip()) < 100:
            return jsonify({"message": "Article content was unavailable or too short.", "data": None}), 200
        sentiment, keywords, category = get_local_analysis(text)
        new_article = Article(url=url, title=title, article_text=text, sentiment_score=sentiment, keywords=keywords, category=category)
        db.session.add(new_article); current_user.articles.append(new_article); db.session.commit()
        return jsonify({'message': 'Article analyzed', 'data': {'title': title, 'sentiment': sentiment, 'keywords': keywords, 'category': category }})
    except Exception as e:
        # ENHANCED ERROR LOGGING
        import traceback
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", flush=True)
        print(f"--- EXCEPTION CAUGHT IN /analyze ROUTE: {e} ---", flush=True)
        traceback.print_exc()
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!", flush=True)
        db.session.rollback()
        return jsonify({'message': 'A server error occurred. Please check the backend logs for details.'}), 500


@app.route('/generate_sso_ticket', methods=['POST'])
@token_required
def generate_sso_ticket(current_user):
    """Generates a secure, single-use ticket for a logged-in user."""
    ticket_string = secrets.token_urlsafe(32)
    # Use utcnow() to create a naive datetime object in UTC
    expiration = dt.datetime.utcnow() + dt.timedelta(seconds=60)
    
    new_ticket = SsoTicket(
        ticket=ticket_string,
        user_id=current_user.id,
        expires_at=expiration
    )
    db.session.add(new_ticket)
    db.session.commit()
    
    return jsonify({'sso_ticket': ticket_string})


@app.route('/redeem_sso_ticket', methods=['POST'])
def redeem_sso_ticket():
    """Redeems a single-use ticket and returns a full JWT session token."""
    data = request.get_json()
    ticket_string = data.get('sso_ticket')

    if not ticket_string:
        return jsonify({'message': 'Ticket is missing'}), 400

    sso_ticket = SsoTicket.query.filter_by(ticket=ticket_string).first()

    # Use utcnow() for simple, naive UTC datetime comparison
    if not sso_ticket or sso_ticket.is_used or sso_ticket.expires_at < dt.datetime.utcnow():
        return jsonify({'message': 'Invalid or expired ticket'}), 401

    # Mark ticket as used
    sso_ticket.is_used = True

    # Use the modern db.session.get() to avoid the legacy warning
    user = db.session.get(User, sso_ticket.user_id) 

    # generate short-lived JWT (30 min)
    token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=24)},
        app.config['SECRET_KEY'],
        "HS256"
    )

    # generate a long-lived refresh token
    refresh_token = secrets.token_urlsafe(64)
    user.refresh_token = refresh_token
    db.session.commit()
    print(
        f"[DEBUG] user {user.username} redeemed SSO ticket and got refresh token: {refresh_token}"
    )

    return jsonify({
        "token": token,
        "refresh_token": refresh_token,
        "username": user.username
    })

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


@app.route("/refresh_token", methods=["POST"])
def refresh_token():
    data = request.get_json()
    incoming_refresh = data.get("refresh_token")


    if not incoming_refresh:
        return jsonify({"message": "Missing refresh token"}), 400

    user = User.query.filter_by(refresh_token=incoming_refresh).first()
    if not user:
        return jsonify({"message": "Invalid refresh token"}), 401

    # issue a fresh JWT
    token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(minutes=30)},
        app.config["SECRET_KEY"],
        "HS256",
    )
    print(f"Refreshed token for user: {user.username}")

    return jsonify({"token": token})


# 7. Main execution block
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000,debug=True)
