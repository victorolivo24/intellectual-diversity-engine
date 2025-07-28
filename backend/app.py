import datetime as dt
import json, os, re, time
import os
from collections import Counter, defaultdict
from functools import wraps
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from requests_oauthlib import OAuth2Session
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
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
import nltk
from nltk.corpus import stopwords
import re
from collections import Counter
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import threading
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration
from config import config_by_name
from flask_migrate import Migrate
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import traceback

# initialize Flask app with database
load_dotenv()
app = Flask(__name__)
# CHANGE ONCE EXTENSION IS ON GOOGLE STORE
CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "https://out-of-the-loop.netlify.app",
                "https://outoftheloop.duckdns.org",
                "chrome-extension://jhagopkncedpehcehocogcbaddheopln",
            ]
        }
    },
)

NLTK_DATA_DIR = os.path.join(os.path.dirname(__file__), "nltk_data")
nltk.data.path.append(NLTK_DATA_DIR)
# Get the environment from the FLASK_ENV variable (defaults to 'dev')
config_name = os.getenv("FLASK_ENV", "dev")
# Load the configuration object from the config.py file
app.config.from_object(config_by_name[config_name])

if app.config["SENTRY_DSN"]:
    sentry_sdk.init(
        dsn=app.config["SENTRY_DSN"],
        integrations=[
            FlaskIntegration(),
        ],
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for performance monitoring.
        traces_sample_rate=1.0,
    )
    print("Sentry error monitoring initialized for the backend.")

db = SQLAlchemy(app)
# connect migration engine
migrate = Migrate(app, db)

# specify path to nltk data
nltk.data.path.append("C:/Users/victo/AppData/Roaming/nltk_data")

# global setup with empty placeholder for fast initial startup of Flask
pipeline_lock = threading.Lock()
sentiment_pipeline = None
# root words for keyword list
lemmatizer = WordNetLemmatizer()

try:
    stopwords.words("english")
except LookupError:
    # This is now just a fallback, the build script should handle it.
    print("Stopwords not found locally, attempting emergency download...")
    nltk.download("stopwords", download_dir=NLTK_DATA_DIR)

# buld stopwords set
stop_words = set(stopwords.words("english"))
custom_stopwords = {
    "reuters",
    "said",
    "would",
    "also",
    "new",
    "one",
    "that",
    "will",
    "us",
    "visit",
    "say",
    "says",
    "told",
    "like",
    "get",
    "going",
    "advertisement",
}
stop_words.update(custom_stopwords)

# Database Models
# association table for User and Article - many users read many articles
reading_list = db.Table(
    "reading_list",
    db.Column("user_id", db.Integer, db.ForeignKey("user.id"), primary_key=True),
    db.Column("article_id", db.Integer, db.ForeignKey("article.id"), primary_key=True),
)


# user model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    # relationship for many-many setup, lazy loading to load articles only when user.articles used- keeps fast and efficient
    articles = db.relationship(
        "Article",
        secondary=reading_list,
        backref=db.backref("readers", lazy=True),
        cascade="all, delete",
    )
    sso_tickets = db.relationship(
        "SsoTicket", backref="user", lazy=True, cascade="all, delete-orphan"
    )
    refresh_token = db.Column(db.String(128), unique=True, nullable=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_reset_token(self):
        token = secrets.token_urlsafe(32)
        expiry = dt.datetime.utcnow() + dt.timedelta(hours=1)

        reset_token = PasswordResetToken(
            token=token,
            user_id=self.id,
            expires_at=expiry,
            is_used=False
        )

        db.session.add(reset_token)
        db.session.commit()

        return token


class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # store each article once - reuse, no duplicates
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    article_text = db.Column(db.Text, nullable=False)
    # time stamp for when article was added
    retrieved_at = db.Column(db.DateTime, nullable=False, default=dt.datetime.utcnow)
    # store results of analysis
    sentiment_score = db.Column(db.Float, nullable=True)
    keywords = db.Column(db.JSON, nullable=True)
    category = db.Column(db.String(50), nullable=True)


# temporary single-use tickets for secure login flow
class SsoTicket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ticket = db.Column(db.String(100), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)


class PasswordResetToken(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False, nullable=False)


# custom topics created by user
class UserTopic(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("name", "user_id", name="_user_topic_uc"),)


# Token Decorator wrapper function used with @token_required in /analyze or /dashboard functions
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # check headers for user login token
        token = request.headers.get("x-access-token")
        if not token:
            return jsonify({"message": "Token is missing"}), 401
        try:
            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            # valid token , fetch user object
            current_user = db.session.get(User, data["id"])
        except:
            # token expired or user ID doesn't exist
            return jsonify({"message": "Token is invalid"}), 401
        return f(current_user, *args, **kwargs)

    return decorated


# outline default topics
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


# find article from soup
def extract_article_text(soup, url=None):
    # Remove irrelevant tags
    irrelevant_tags = [
        "script",
        "style",
        "header",
        "footer",
        "nav",
        "aside",
        "form",
        "noscript",
    ]
    for tag in irrelevant_tags:
        for s in soup.select(tag):
            s.decompose()

    # Primary selectors that often contain article content
    selectors = [
        "article",
        "[role='main']",
        "#main",
        "#main-content",
        ".main-content",
        ".article",
        ".article-body",
        "div.article-body",
        ".article-content",
        ".post-content",
        ".entry-content",
        ".content__article-body",
        ".story-body",
        ".StandardArticleBody_body",
        ".content-body",
        "[data-testid='article-body']",
        "[itemprop='articleBody']",
        "[class*='article-body']",
        "[class*='story-body']",
        "[class*='post-body']",
    ]

    for selector in selectors:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(separator="\n", strip=True)
            if len(text) > 250:
                return text

    # helper function to score divs to find most likely article text
    def score_candidate(tag):
        text = tag.get_text(separator="\n", strip=True)
        p_tags = tag.find_all("p")
        a_tags = tag.find_all("a")
        img_tags = tag.find_all("img")
        score = len(text) + len(p_tags) * 20 - len(a_tags) * 10 - len(img_tags) * 10
        return score, text

    best_score = 0
    best_text = ""
    for container in soup.find_all(["div", "section"]):
        score, text = score_candidate(container)
        if score > best_score and len(text) > 250:
            best_score = score
            best_text = text

    if best_text:
        return best_text

    # plan b if text is not in one of primary selectors, look for div with largest block of text
    divs = soup.find_all("div")
    longest_text = ""
    max_len = 0
    for div in divs:
        if div:
            text = div.get_text(separator="\n", strip=True)
            if len(text) > max_len:
                max_len = len(text)
                longest_text = text

    # return if larger than 250 characters
    if len(longest_text) > 250:
        return longest_text

    #
    paragraphs = soup.find_all("p")
    combined_paragraphs = "\n".join([p.get_text(strip=True) for p in paragraphs])
    if len(combined_paragraphs) > 250:
        return combined_paragraphs

    # can't find container for text body, return all text
    return soup.get_text(separator="\n", strip=True)


import re


def clean_article_text(text):
    # Normalize line endings and whitespace
    text = re.sub(r"\r\n|\r", "\n", text)  # normalize newlines
    text = re.sub(r"\s+", " ", text)  # collapse excessive spaces
    text = re.sub(r"\n{2,}", "\n\n", text)  # collapse >2 newlines to 2

    # Generic phrases that usually indicate non-article content
    cutoff_phrases = [
        "Related Articles",
        "Related Stories",
        "Read More",
        "Recommended for You",
        "More from",
        "You might also like",
        "Top Stories",
        "Sponsored Content",
        "Advertisement",
        "Leave a comment",
        "Share this article",
        "See All Newsletters",
        "All rights reserved",
        "Click to copy link",
        "Most Popular",
        "Join the conversation",
        "Subscribe to our newsletter",
        "TRENDING NOW",
        "Presented by",
        "Sponsored Links",
        "Terms of Service",
        "Privacy Policy",
        "Give feedback",
    ]

    # Cut off the article at the earliest occurrence of any boilerplate phrase
    for phrase in cutoff_phrases:
        index = text.lower().find(phrase.lower())
        if index != -1 and index > 200:  # avoid false positives at the top
            text = text[:index]
            break

    # Remove common inline ad or UI junk
    removal_patterns = [
        r"^\s*Advertisement\s*$",
        r"^\s*Sponsored\s*$",
        r"^\s*Undo\s*$",
        r"^\s*Newsletter.*$",
        r"^\s*Follow us on.*$",
        r"^\s*Read full story at.*$",
        r"^\s*More coverage:.*$",
        r"^\s*Watch now.*$",
        r"^\s*Tap here.*$",
        r"^\s*Trending.*$",
    ]

    for pattern in removal_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE | re.MULTILINE)

    # Remove repeated junk like "AP News" or "CNN" showing up multiple times
    text = re.sub(r"\b(?:AP News|CNN|Fox News|Reuters|NBC News)\b", "", text)

    # Final strip and cleanup
    text = text.strip()
    return text


# load large AI model into memory efficiently (lazy loading)
def get_sentiment_pipeline():
    """Initializes and returns the sentiment analysis pipeline using a thread-safe lock."""
    global sentiment_pipeline
    with pipeline_lock:
        if sentiment_pipeline is None:
            print(
                "--- First request: Loading custom sentiment model... ---", flush=True
            )

            # Robust absolute model path
            basedir = os.path.abspath(os.path.dirname(__file__))
            model_path = os.path.join(basedir, "out-of-the-loop-production-model")

            print(f"--- Attempting to load model from: {model_path} ---", flush=True)

            # Explicit loading with local_files_only here (safe)
            model = AutoModelForSequenceClassification.from_pretrained(
                model_path, local_files_only=True
            )
            tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)

            # Create the pipeline without passing local_files_only again
            sentiment_pipeline = pipeline(
                "sentiment-analysis", model=model, tokenizer=tokenizer
            )

            print("--- Sentiment model loaded successfully. ---", flush=True)
    return sentiment_pipeline


# extract keywords from raw text
def extract_keywords(text, max_keywords=7):
    text = text.lower()
    # find all words (tokenize text)
    words = re.findall(r"\b[a-z]+\b", text)
    words = [w for w in words if w not in stop_words and len(w) > 3]
    # reduce words to root form
    words = [lemmatizer.lemmatize(w) for w in words]
    # dict for frequency of words
    keyword_counts = Counter(words)
    # return most frequent words sorted from most to least frequent counts
    return [word for word, _ in keyword_counts.most_common(max_keywords)]


# Category Texts with buzzwords for Cosine Similarity
CATEGORY_TEXTS = {
    "Technology": "apple google microsoft amazon facebook meta tesla spacex ai artificial intelligence software hardware crypto bitcoin blockchain phone laptop app",
    "Politics": "senate congress white house president biden trump republican democrat election vote law policy government senator governor",
    "Sports": "nba nfl mlb nhl soccer football basketball baseball playoffs championship lebron messi ronaldo game match team",
    "Business": "stocks market wall street dow jones nasdaq economy business company ceo earnings profit investor shares ipo",
    "Health": "health medical doctor hospital fda cdc virus vaccine disease medicine study",
    "Entertainment": "movie film hollywood celebrity music album song grammy oscar actor actress tv show",
    "Science": "science nasa space research discovery study climate environment planet mars",
    "World News": "china russia ukraine europe asia africa middle east un united nations war conflict diplomacy",
}

vectorizer = TfidfVectorizer(
    stop_words="english",  # drop common words
    ngram_range=(1, 2),  # include bigrams
    sublinear_tf=True,  # dampen very frequent terms
)
CATEGORY_FINGERPRINTS = list(CATEGORY_TEXTS.values())
CATEGORY_NAMES = list(CATEGORY_TEXTS.keys())
# fit only on the fingerprints -> fixed IDF space
fingerprint_matrix = vectorizer.fit_transform(CATEGORY_FINGERPRINTS)


# Category Detection via TF-IDF + Cosine Similarity
def categorize_article(text):
    # vectorize the article alone
    article_vec = vectorizer.transform([text])
    # compute cosines VS pre-built fingerprints
    sims = cosine_similarity(article_vec, fingerprint_matrix).flatten()
    best_idx = sims.argmax()
    best_score = sims[best_idx]

    # low threshold
    if best_score < 0.02:
        return "Other"
    return CATEGORY_NAMES[best_idx]


# local analysis using trained ML model (out-of-the-loop-production-model)
def get_local_analysis(text):
    print("Getting analysis from local model...", flush=True)
    # call lazy loader function to load model into memory
    pipeline = get_sentiment_pipeline()

    # send first 512 tokens to BERT model (due to transformer architecture limit), extract result dictionary from list that pipeline returns
    result = pipeline(text[:512])[0]
    raw_score = result["score"]
    # transform model output (0 to 1) to (-1 to 1)
    sentiment_score = (raw_score * 2) - 1
    # clamp score to min and max bounds
    sentiment_score = max(-1.0, min(1.0, sentiment_score))

    # Category via cosine similarity
    category = categorize_article(text)

    # Extract refined keywords
    keywords = extract_keywords(text)

    return sentiment_score, keywords, category


# API routes


@app.route("/analyze", methods=["POST"])
@token_required
def analyze(current_user):
    html_content = request.get_json().get("html_content")
    if not html_content:
        return jsonify({"message": "HTML content is required"}), 400

    try:
        data = request.get_json()
        html_content = data.get("html_content", "")
        visible_text = data.get("visible_text", "")

        print("📥 Received analyze request")
        soup = BeautifulSoup(html_content, "html.parser")

        text = visible_text or extract_article_text(soup)
        print(f"✅ Text: {text[:80]}")

        title_tag = soup.find("title")
        if title_tag and title_tag.get_text(strip=True):
            title = title_tag.get_text(strip=True)
        else:
            title = text.split("\n")[0][:80] if text else "No Title"

        url_element = soup.find("link", rel="canonical")
        url = url_element["href"] if url_element else "Unknown URL"

        if not text or len(text.strip()) < 100:
            return jsonify({
                "message": "Failed to extract article content. The page may be protected or rendered with JavaScript.",
                "data": None
            }), 400

        sentiment, keywords, category = get_local_analysis(text)

        return jsonify({
            "message": "Analysis complete",
            "data": {
                "url": url,
                "title": title,
                "sentiment": sentiment,
                "keywords": keywords,
                "category": category,
                "article_text": text,
            }
        })

    except Exception as e:
        import traceback
        print("❌ UNHANDLED EXCEPTION IN /analyze:", e)
        traceback.print_exc()
        return jsonify({
            "message": "A server error occurred during analysis.",
            "details": str(e)
        }), 500


@app.route("/save_analysis", methods=["POST"])
@token_required
def save_analysis(current_user):
    data = request.get_json()
    if not data.get("save_to_history"):
        return (
            jsonify({"message": "Not saved.", "count": len(current_user.articles)}),
            200,
        )

    try:
        existing = Article.query.filter_by(url=data["url"]).first()
        if existing:
            if existing not in current_user.articles:
                current_user.articles.append(existing)
                db.session.commit()
            message = "Article added to history."
        else:
            new_article = Article(
                url=data["url"],
                title=data["title"],
                article_text=data["article_text"],
                sentiment_score=data["sentiment"],
                keywords=data["keywords"],
                category=data["category"],
            )
            db.session.add(new_article)
            current_user.articles.append(new_article)
            db.session.commit()
            message = "New article saved and added to history."

        # Now count them
        count = len(current_user.articles)
        return jsonify({"message": message, "count": count}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "A server error occurred while saving."}), 500


# Single Sign-On (SSO) Routes
@app.route("/generate_sso_ticket", methods=["POST"])
@token_required
def generate_sso_ticket(current_user):
    """Generates a secure, single-use ticket for a logged-in user."""
    ticket_string = secrets.token_urlsafe(32)
    # Use utcnow() to create a naive datetime object in UTC
    expiration = dt.datetime.utcnow() + dt.timedelta(seconds=60)

    new_ticket = SsoTicket(
        ticket=ticket_string, user_id=current_user.id, expires_at=expiration
    )
    db.session.add(new_ticket)
    db.session.commit()

    return jsonify({"sso_ticket": ticket_string})


@app.route("/redeem_sso_ticket", methods=["POST"])
def redeem_sso_ticket():
    """Redeems a single-use ticket and returns a full JWT session token."""
    data = request.get_json()
    ticket_string = data.get("sso_ticket")

    if not ticket_string:
        return jsonify({"message": "Ticket is missing"}), 400

    sso_ticket = SsoTicket.query.filter_by(ticket=ticket_string).first()

    # Use utcnow() for simple, naive UTC datetime comparison
    if (
        not sso_ticket
        or sso_ticket.is_used
        or sso_ticket.expires_at < dt.datetime.utcnow()
    ):
        return jsonify({"message": "Invalid or expired ticket"}), 401

    # Mark ticket as used
    sso_ticket.is_used = True

    # Use the modern db.session.get() to avoid the legacy warning
    user = db.session.get(User, sso_ticket.user_id)

    # generate short-lived JWT (30 min)
    token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=24)},
        app.config["SECRET_KEY"],
        "HS256",
    )

    # generate a long-lived refresh token
    refresh_token = secrets.token_urlsafe(64)
    user.refresh_token = refresh_token
    db.session.commit()
    print(
        f"[DEBUG] user {user.email} redeemed SSO ticket and got refresh token: {refresh_token}"
    )

    return jsonify(
        {"token": token, "refresh_token": refresh_token, "email": user.email}
    )


# Authentication Routes


@app.route("/")
def index():
    """A simple health check endpoint."""
    return jsonify({"status": "ok", "message": "Backend is running."})


@app.route("/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    """A simple protected route to check a token's validity."""
    if not current_user:
        # This case is unlikely due to the decorator, but good for safety
        return jsonify({"message": "Invalid token."}), 401

    return jsonify({"email": current_user.email}), 200


EMAIL_REGEX = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"


@app.route("/register", methods=["POST"])
def register():
    print("1 - Route hit")
    data = request.get_json()
    print("2 - Parsed data")

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        print("3 - Missing fields")
        return jsonify({"message": "Email and password are required"}), 400

    if not re.match(EMAIL_REGEX, email):
        print("4 - Invalid format")
        return jsonify({"message": "Invalid email format"}), 400

    print("5 - Passed validation")

    if User.query.filter_by(email=email).first():
        print("6 - Email already exists")
        return jsonify({"message": "An account with this email already exists"}), 409

    print("7 - Creating user object")
    user = User(email=email)

    print("8 - Setting password")
    user.set_password(password)

    print("9 - Adding to DB")
    db.session.add(user)

    print("10 - Committing to DB")
    db.session.commit()

    print("11 - Success")
    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401

    token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=24)},
        app.config["SECRET_KEY"],
        "HS256",
    )
    # We will return the email to be stored on the frontend
    return jsonify({"token": token, "email": user.email})


@app.route("/account/delete", methods=["DELETE"])
@token_required
def delete_account(current_user):
    """Deletes the current user and all of their associated data."""
    if not current_user:
        return jsonify({"message": "User not found."}), 404

    try:
        # Before deleting the user, SQLAlchemy with our setup will handle
        # deleting their entries from the reading_list. We will also
        # manually delete their custom topics.
        UserTopic.query.filter_by(user_id=current_user.id).delete()

        # Now, delete the user itself
        db.session.delete(current_user)

        # Commit the changes to the database
        db.session.commit()

        return jsonify({"message": "Account deleted successfully."}), 200
    except Exception as e:
        db.session.rollback()
        print(f"--- ERROR during account deletion: {e} ---", flush=True)
        return jsonify({"message": "An error occurred during account deletion."}), 500


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
    print(f"Refreshed token for user: {user.email}")

    return jsonify({"token": token})


def send_email(to_email, subject, html_content):
    message = Mail(
        from_email=os.environ.get("FROM_EMAIL"),
        to_emails=to_email,
        subject=subject,
        html_content=html_content,
    )

    try:
        sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY"))
        response = sg.send(message)
        print(f"Email sent to {to_email} - Status: {response.status_code}")
    except Exception as e:
        print(f"Error sending email: {e}")


@app.route("/request-password-reset", methods=["POST"])
def request_password_reset():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "No user found with that email"}), 404

    try:
        token = user.get_reset_token()
    except Exception as e:
        print(f"Error generating reset token: {e}")
        return jsonify({"error": "Failed to generate reset token"}), 500

    reset_link = f"https://out-of-the-loop.netlify.app/reset-password/{token}"

    try:
        send_email(
            to_email=email,
            subject="Reset your password",
            html_content=f"<p>Click the link below to reset your password:</p><a href='{reset_link}'>{reset_link}</a>",
        )
    except Exception as e:
        print(f"Error sending reset email: {e}")
        return jsonify({"error": "Failed to send reset email"}), 500

    return jsonify({"message": "Password reset link sent"}), 200


@app.route("/perform-password-reset", methods=["POST"])
def perform_password_reset():
    """
    Handles the final password reset using a valid token.
    """
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return jsonify({"message": "Token and new password are required."}), 400

    # Find the token in the database
    reset_token = PasswordResetToken.query.filter_by(token=token).first()

    # Security Checks
    if (
        not reset_token
        or reset_token.is_used
        or reset_token.expires_at < dt.datetime.utcnow()
    ):
        return jsonify({"message": "This reset link is invalid or has expired."}), 401

    # Find the associated user
    user = db.session.get(User, reset_token.user_id)
    if not user:
        return jsonify({"message": "User not found."}), 404

    # Update the password and mark the token as used
    user.set_password(new_password)
    reset_token.is_used = True
    db.session.commit()

    return jsonify({"message": "Password has been reset successfully."}), 200


@app.route("/login/google")
def google_login():
    """
    Redirects the user to Google's authentication page, remembering the origin.
    """
    print("Redirecting to Google with redirect_uri:", app.config["GOOGLE_REDIRECT_URI"])

    # Get the origin ('dashboard' or 'extension') from the URL
    origin_state = request.args.get("state", "dashboard")  # Default to dashboard

    scope = [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]
    google = OAuth2Session(
        app.config["GOOGLE_CLIENT_ID"],
        scope=scope,
        redirect_uri=app.config["GOOGLE_REDIRECT_URI"],
    )
    authorization_url, state = google.authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        access_type="offline",
        prompt="select_account",
    )

    # Store both the OAuth state and our origin state in the session
    session["oauth_state"] = state
    session["origin_state"] = origin_state

    return redirect(authorization_url)


@app.route("/auth/google/callback")
def google_callback():
    """
    Handles the callback from Google and redirects based on the origin.
    """
    google = OAuth2Session(
        app.config["GOOGLE_CLIENT_ID"],
        state=session.get("oauth_state"),
        redirect_uri=app.config["GOOGLE_REDIRECT_URI"],
    )
    token = google.fetch_token(
        "https://www.googleapis.com/oauth2/v4/token",
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        authorization_response=request.url,
    )
    user_info = google.get("https://www.googleapis.com/oauth2/v1/userinfo").json()

    if not user_info.get("verified_email"):
        return "User email not available or not verified by Google.", 400

    user_email = user_info["email"]

    # Find or create the user in our database
    user = User.query.filter_by(email=user_email).first()
    if not user:
        new_password = secrets.token_urlsafe(16)
        user = User(email=user_email)
        user.set_password(new_password)
        db.session.add(user)
        db.session.commit()

    # Issue our application's own JWT token
    app_token = jwt.encode(
        {"id": user.id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=24)},
        app.config["SECRET_KEY"],
        "HS256",
    )

    # Check where the login started and redirect to the correct place
    origin = session.get("origin_state", "dashboard")
    if origin == "extension":
        extension_id = "jhagopkncedpehcehocogcbaddheopln"
       

        return redirect(
            f"chrome-extension://{extension_id}/oauth_callback.html?token={app_token}&email={user.email}"
        )
    else:  # Default to dashboard
        return redirect(
            f"https://out-of-the-loop.netlify.app?token={app_token}&email={user.email}"
        )


# Dashboard Data Endpoints
@app.route("/dashboard", methods=["GET"])
@token_required
def dashboard(current_user):
    articles = [
        {
            "id": a.id,
            "title": a.title,
            "url": a.url,
            "sentiment": a.sentiment_score,
            "keywords": a.keywords,
            "category": a.category,
        }
        for a in current_user.articles
    ]
    return jsonify(articles)


@app.route("/category_analysis", methods=["GET"])
@token_required
def category_analysis(current_user):
    category_sentiments = defaultdict(lambda: {"total_score": 0, "count": 0})
    for article in current_user.articles:
        if article.category and article.sentiment_score is not None:
            category_sentiments[article.category][
                "total_score"
            ] += article.sentiment_score
            category_sentiments[article.category]["count"] += 1
    analysis_results = [
        {
            "category": cat,
            "average_sentiment": data["total_score"] / data["count"],
            "article_count": data["count"],
        }
        for cat, data in category_sentiments.items()
        if data["count"] > 0
    ]
    analysis_results.sort(key=lambda x: (-x["article_count"], x["category"]))
    return jsonify(analysis_results)


@app.route("/source_analysis", methods=["GET"])
@token_required
def source_analysis(current_user):
    domains = [
        urlparse(article.url).netloc.replace("www.", "")
        for article in current_user.articles
    ]
    domain_counts = Counter(domains)
    sorted_domains = sorted(domain_counts.items(), key=lambda item: (-item[1], item[0]))
    result = [{"domain": domain, "count": count} for domain, count in sorted_domains]
    return jsonify(result)


@app.route("/sentiment_timeline", methods=["GET"])
@token_required
def sentiment_timeline(current_user):
    """
    Groups articles by date and calculates the average sentiment
    and article count for each day.
    """
    daily_data = defaultdict(lambda: {"scores": [], "count": 0})

    for article in current_user.articles:
        day = article.retrieved_at.strftime("%Y-%m-%d")
        daily_data[day]["scores"].append(article.sentiment_score)
        daily_data[day]["count"] += 1

    analysis_results = []
    for day, data in daily_data.items():
        if data["count"] > 0:
            average = sum(data["scores"]) / len(data["scores"])
            analysis_results.append(
                {
                    "date": day,
                    "average_sentiment": average,
                    "article_count": data["count"],  # Add the article count
                }
            )

    analysis_results.sort(key=lambda item: item["date"])

    return jsonify(analysis_results)


@app.route("/move_article", methods=["POST"])
@token_required
def move_article(current_user):
    data = request.get_json()
    article_id = data.get("article_id")
    new_category = data.get("new_category")

    # Combine all topics for validation
    custom_topics = [
        topic.name for topic in UserTopic.query.filter_by(user_id=current_user.id).all()
    ]
    valid_categories = DEFAULT_TOPICS + custom_topics

    if not article_id or not new_category or new_category not in valid_categories:
        return jsonify({"message": "Invalid request data"}), 400

    article = db.session.get(Article, article_id)

    if not article or article not in current_user.articles:
        return jsonify({"message": "Article not found or access denied"}), 404

    article.category = new_category
    db.session.commit()
    return jsonify(
        {
            "message": f"Article '{article.title}' moved to '{new_category}' successfully."
        }
    )


# Topic Mangement Routes
@app.route("/topics", methods=["GET"])
@token_required
def get_topics(current_user):
    custom_topics = [
        topic.name for topic in UserTopic.query.filter_by(user_id=current_user.id).all()
    ]
    return jsonify(
        {"default_topics": DEFAULT_TOPICS, "custom_topics": sorted(custom_topics)}
    )


@app.route("/topics", methods=["POST"])
@token_required
def create_topic(current_user):
    data = request.get_json()
    new_topic_name = data.get("name", "").strip()
    if not new_topic_name or len(new_topic_name) > 50:
        return jsonify({"message": "Invalid topic name"}), 400
    existing_custom = UserTopic.query.filter_by(
        user_id=current_user.id, name=new_topic_name
    ).first()
    if new_topic_name in DEFAULT_TOPICS or existing_custom:
        return jsonify({"message": "Topic already exists"}), 409
    topic = UserTopic(name=new_topic_name, user_id=current_user.id)
    db.session.add(topic)
    db.session.commit()
    return jsonify({"message": "Topic created successfully"}), 201


@app.route("/topics/<string:topic_name>", methods=["DELETE"])
@token_required
def delete_topic(current_user, topic_name):
    if topic_name in DEFAULT_TOPICS:
        return jsonify({"message": "Cannot delete a default topic"}), 403
    topic_to_delete = UserTopic.query.filter_by(
        user_id=current_user.id, name=topic_name
    ).first()
    if not topic_to_delete:
        return jsonify({"message": "Custom topic not found"}), 404
    articles_in_topic = Article.query.filter(
        Article.readers.any(id=current_user.id), Article.category == topic_name
    ).first()
    if articles_in_topic:
        return (
            jsonify(
                {"message": "Cannot delete topic. Articles are still assigned to it."}
            ),
            409,
        )
    db.session.delete(topic_to_delete)
    db.session.commit()
    return jsonify({"message": "Topic deleted successfully"})


# 7. Main execution block
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(port=5000, debug=True)
