import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
import joblib

# 1. Load the dataset
df = pd.read_csv("news_sentiment_analysis.csv")

# 2. Only keep relevant columns
df = df[["Description", "Sentiment"]].dropna()

# 3. Convert sentiments to standardized labels
df["Sentiment"] = (
    df["Sentiment"].str.lower().map({"positive": 1, "negative": -1, "neutral": 0})
)

# 4. Split data
X_train, X_test, y_train, y_test = train_test_split(
    df["Description"], df["Sentiment"], test_size=0.2, random_state=42
)

# 5. Vectorize text
vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
X_train_vect = vectorizer.fit_transform(X_train)
X_test_vect = vectorizer.transform(X_test)

# 6. Train logistic regression
model = LogisticRegression(max_iter=200)
model.fit(X_train_vect, y_train)

# 7. Evaluate
preds = model.predict(X_test_vect)
print(classification_report(y_test, preds))

# 8. Save the model
joblib.dump(model, "sentiment_model.joblib")
joblib.dump(vectorizer, "sentiment_vectorizer.joblib")

print("✅ Model and vectorizer saved.")
