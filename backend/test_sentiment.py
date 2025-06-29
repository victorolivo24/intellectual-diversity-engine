from transformers import pipeline
from nltk.corpus import stopwords
from collections import Counter
import re
import nltk

nltk.download("stopwords")

# reuse the same get_bert_analysis
sentiment_pipeline = pipeline("sentiment-analysis")
stop_words = set(stopwords.words("english"))


def get_bert_analysis(text):
    short_text = text[:512]
    result = sentiment_pipeline(short_text)[0]
    label = result["label"]
    confidence = result["score"]

    if label == "POSITIVE":
        sentiment_score = 0.8 * confidence
    elif label == "NEGATIVE":
        sentiment_score = -0.8 * confidence
    else:
        sentiment_score = 0.0

    tokens = re.findall(r"\b\w+\b", text.lower())
    filtered_tokens = [w for w in tokens if w not in stop_words and len(w) > 2]
    token_counts = Counter(filtered_tokens)
    keywords = [w for w, c in token_counts.most_common(7)]

    categories = [
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
    category = "Other"
    for cat in categories:
        if cat.lower() in text.lower():
            category = cat
            break

    return sentiment_score, keywords, category


# --- TEST CASES ---
samples = [
    (
        "The new community center offers free classes and activities for local children.",
        "positive",
    ),
    ("A tragic fire destroyed dozens of homes last night.", "negative"),
    ("Lawmakers reached a compromise after weeks of tense debate.", "neutral/positive"),
    ("The local festival was canceled because of safety concerns.", "negative"),
    ("A new tech startup is revolutionizing the way we order groceries.", "positive"),
]

for idx, (text, expected) in enumerate(samples, 1):
    score, keywords, category = get_bert_analysis(text)
    print(f"Test {idx}: {text[:50]}...")
    print(f"  Sentiment Score: {score:.2f}")
    print(f"  Keywords: {keywords}")
    print(f"  Category: {category}")
    print(f"  Expected: {expected}")
    print("---")
