# In download_nltk_data.py
import nltk
import os

# Define a local path right inside our project
DOWNLOAD_DIR = os.path.join(os.getcwd(), "nltk_data")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

print(f"--- Downloading NLTK data to local directory: {DOWNLOAD_DIR}... ---")
nltk.download("stopwords", download_dir=DOWNLOAD_DIR)
nltk.download("wordnet", download_dir=DOWNLOAD_DIR)
print("--- NLTK data downloaded successfully. ---")
