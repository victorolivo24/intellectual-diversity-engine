import pandas as pd
import google.generativeai as genai
import os
import time

# 1. Load your Gemini API key
os.environ["GOOGLE_API_KEY"] = "YOUR_REAL_API_KEY"
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

# 2. Load data
df = pd.read_csv("mind_articles.csv")

# Initialize sentiment_score column if missing
if "sentiment_score" not in df.columns:
    df["sentiment_score"] = pd.NA

print(f"Total samples: {len(df)}")

# 3. Gemini model
model = genai.GenerativeModel("gemini-pro")

# 4. Process in chunks
BATCH_SIZE = 100
SLEEP_BETWEEN_BATCHES = 60  # 1 minute between batches

# work only on rows that do not have a sentiment score
remaining = df[df["sentiment_score"].isna()]
total_remaining = len(remaining)
print(f"Labeling {total_remaining} rows that are still missing scores...")

for i in range(0, total_remaining, BATCH_SIZE):
    batch = remaining.iloc[i : i + BATCH_SIZE]
    for idx, row in batch.iterrows():
        text = row["full_text"]
        prompt = f"""
        Analyze the sentiment of the following news article. 
        Return a single decimal number from -1.0 (extremely negative) 
        to 1.0 (extremely positive). Only return the numeric score with no explanation.
        Article:
        {text}
        """
        try:
            response = model.generate_content(prompt)
            answer = response.text.strip()
            score = float(answer)
            df.at[idx, "sentiment_score"] = score
            print(f"[{idx}] score = {score}")
        except Exception as e:
            print(f"Error at row {idx}: {e}")
            df.at[idx, "sentiment_score"] = 0.0  # fallback

        time.sleep(1)  # 1 second between individual calls

    # Save checkpoint after each batch
    df.to_csv("mind_articles_labeled.csv", index=False)
    print(f"✅ Batch {i//BATCH_SIZE + 1} saved.")
    print("Sleeping between batches...")
    time.sleep(SLEEP_BETWEEN_BATCHES)

print("🎉 All done. Final saved as mind_articles_labeled.csv")
