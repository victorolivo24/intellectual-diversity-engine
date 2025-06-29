# verify_news_dataset.py
import pandas as pd

df = pd.read_csv("news_sentiment_analysis.csv")
print(df.head())
print(df.columns)
