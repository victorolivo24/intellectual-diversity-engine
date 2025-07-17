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
import re
from collections import Counter
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from transformers import pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import threading

# initialize Flask app with database
load_dotenv()
app = Flask(__name__)
CORS(app)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)
# specify path to nltk data
nltk.data.path.append("C:/Users/victo/AppData/Roaming/nltk_data")

# global setup with empty placeholder for fast initial startup of Flask
pipeline_lock = threading.Lock()
sentiment_pipeline = None
# root words for keyword list
lemmatizer = WordNetLemmatizer()
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
    "advertisement"
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
    username = db.Column(db.String(80), unique=True, nullable=False)
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


class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # store each article once - reuse, no duplicates
    url = db.Column(db.String(500), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    article_text = db.Column(db.Text, nullable=False)
    # time stamp for when article was added
    retrieved_at = db.Column(
        db.DateTime, nullable=False, default=dt.datetime.utcnow
    )  
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
        ".article-content",
        ".article-body",
        ".post-content",
        ".entry-content",
        ".content__article-body",
        ".story-body",
        ".StandardArticleBody_body",
        ".content-body",
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

# load large AI model into memory efficiently (lazy loading)
def get_sentiment_pipeline():
    global sentiment_pipeline
    # load requests one at a time to prevent race condition
    with pipeline_lock:
        # load model for first time
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

CATEGORY_FINGERPRINTS = list(CATEGORY_TEXTS.values())
CATEGORY_NAMES = list(CATEGORY_TEXTS.keys())

# Category Detection via TF-IDF + Cosine Similarity
def categorize_article(text):
    # group article and strings of keywords
    texts = [text] + CATEGORY_FINGERPRINTS
    # convert text to numerical representation as vector with weights
    vectorizer = TfidfVectorizer().fit_transform(texts)
    # calculate similarity between two vectors for each category
    cosine_sim = cosine_similarity(vectorizer[0:1], vectorizer[1:]).flatten()
    # find and return category with highest similarity score
    max_index = cosine_sim.argmax()
    return (
        CATEGORY_NAMES[max_index] if cosine_sim[max_index] > 0.1 else "Other"
    )

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
    # get html content from client
    html_content = request.get_json().get("html_content")
    if not html_content:
        return jsonify({"message": "HTML content not received"}), 400

    try:
        soup = BeautifulSoup(html_content, "html.parser")

        # try to extract original url from metadata
        url_element = soup.find("link", rel="canonical")
        url = url_element["href"] if url_element else "Unknown URL"

        # Check if this article is already in the database
        existing = Article.query.filter_by(url=url).first()
        if existing:
            # create link between current user and existing article in reading_list association table
            if existing not in current_user.articles:
                current_user.articles.append(existing)
                db.session.commit()
            # send cached JSON back to browser extension
            return jsonify(
                {
                    "message": "Article added to history",
                    "data": {
                        "title": existing.title,
                        "sentiment": existing.sentiment_score,
                        "keywords": existing.keywords,
                        "category": existing.category,
                        "article_text": existing.article_text,
                    },
                }
            )

        # extract title and text
        title = (
            soup.find("title").get_text(strip=True)
            if soup.find("title")
            else "Untitled"
        )
        text = extract_article_text(soup)
        print(text)
        # validate text
        if not text or len(text.strip()) < 100:
            return (
                jsonify({"message": "⚠️ Article content was unavailable or too short."}),
                200,
            )

        # pass clean text to local analysis pipeline
        sentiment, keywords, category = get_local_analysis(text)

        # save results as Article in database
        new_article = Article(
            url=url,
            title=title,
            article_text=text,
            sentiment_score=sentiment,
            keywords=keywords,
            category=category,
        )
        db.session.add(new_article)

        # create link between current user and new article in reading_list association table
        current_user.articles.append(new_article)
        db.session.commit()

        # send JSON back to browser extension
        return jsonify(
            {
                "message": "Article analyzed",
                "data": {
                    "title": title,
                    "sentiment": sentiment,
                    "keywords": keywords,
                    "category": category,
                    "article_text": text,
                },
            }
        )

    except Exception as e:
        # undo any partial databased changes from failed transaction, prevents data corruption
        db.session.rollback()

        # return message based on error
        user_friendly_msg = (
            "An unexpected error occurred while analyzing this article. "
            "It may not be compatible with our system."
        )
        # Log the detailed error for debugging
        print(f"--- EXCEPTION IN /analyze: {e} ---", flush=True)
        import traceback

        traceback.print_exc()

        return jsonify({"message": user_friendly_msg}), 500


# Single Sign-On (SSO) Routes
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

# Authentication Routes


@app.route("/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    """A simple protected route to check a token's validity."""
    if not current_user:
        # This case is unlikely due to the decorator, but good for safety
        return jsonify({"message": "Invalid token."}), 401

    return jsonify({"username": current_user.username}), 200


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
    print(f"Refreshed token for user: {user.username}")

    return jsonify({"token": token})


@app.route("/request-password-reset", methods=["POST"])
def request_password_reset():
    """
    Handles the initial password reset request from a user.
    """
    data = request.get_json()
    username = data.get("username")
    user = User.query.filter_by(username=username).first()

    if user:
        # Generate a secure, URL-safe token
        token = secrets.token_urlsafe(32)
        # Set an expiration time (e.g., 1 hour from now)
        expiration = dt.datetime.utcnow() + dt.timedelta(hours=1)

        # Create and save the reset token record
        reset_token = PasswordResetToken(
            user_id=user.id, token=token, expires_at=expiration
        )
        db.session.add(reset_token)
        db.session.commit()

        # For development, we print the link instead of emailing it.
        # In production, you would use a service like SendGrid or Mailgun here.
        reset_link = f"http://localhost:3000/reset-password/{token}"
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print(f"--- PASSWORD RESET LINK (for user: {user.username}): {reset_link} ---")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

    # Always return a generic success message to prevent user enumeration.
    # We don't want to confirm whether an email/username exists in our system.
    return (
        jsonify(
            {
                "message": "If an account with that username exists, a password reset link has been sent."
            }
        ),
        200,
    )


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

    # --- Security Checks ---
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
    daily_sentiments = defaultdict(list)
    for article in current_user.articles:
        day = article.retrieved_at.strftime("%Y-%m-%d")
        daily_sentiments[day].append(article.sentiment_score)
    analysis_results = [
        {"date": day, "average_sentiment": sum(scores) / len(scores)}
        for day, scores in daily_sentiments.items()
        if scores
    ]
    analysis_results.sort(key=lambda item: item["date"])
    return jsonify(analysis_results)

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
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5000,debug=True)
