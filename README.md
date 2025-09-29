# Out of the Loop

A full-stack platform to help you analyze your news consumption and break free from your personal "You-loop."

> **Note:** This is a placeholder. It's highly recommended to replace this with a real screenshot of your project dashboard.

---

## 📖 About The Project

In an increasingly polarized media landscape, it's easy to get stuck in a "You-loop"—an information bubble where we are repeatedly exposed to the same perspectives and emotional tones. **Out of the Loop** is a tool designed to provide users with a data-driven overview of their own media consumption habits.

With a single click, the Chrome extension performs real-time sentiment analysis on any news article. This data is then sent to a private, personalized web dashboard where users can track trends, visualize their reading history, and gain a more conscious understanding of their "information diet."

The goal is not to label sources as "good" or "bad," but to empower users with self-awareness.

---

## ✨ Key Features
- **One-Click Sentiment Analysis:** Instantly analyze the emotional tone of any news article directly in your browser.  
- **Personal Data Dashboard:** A private and secure web application to visualize your reading habits over time.  
- **Nuanced AI Model:** Powered by a fine-tuned BERT (Transformer) model, trained specifically on news and journalistic content for higher accuracy.  
- **Secure & Private:** Your reading data is your own.  

---

## 🚀 How It Works
1. **Install the Extension:** Load the free extension into your Chrome browser.  
2. **Analyze an Article:** When reading a news article, click the "Out of the Loop" extension icon.  
3. **Get Instant Feedback:** The extension sends the article content to the backend API, which returns a sentiment score from `-1.0` (very negative) to `1.0` (very positive).  
4. **Track Your Habits:** The result is automatically logged to your personal dashboard.  
5. **Visualize the Trends:** Visit the web dashboard at any time to see charts and insights about the content you consume.  

---

## 🛠️ Tech Stack

| Tier        | Technology |
|-------------|------------|
| **Frontend** | React.js, Chrome Extension APIs, TailwindCSS, Recharts |
| **Backend**  | Python 3, Flask |
| **AI / ML**  | PyTorch, Hugging Face Transformers (BERT) |
| **Database** | PostgreSQL (via AWS RDS) |
| **Deployment** | AWS EC2 (Flask API), AWS S3/CloudFront (React frontend) |
