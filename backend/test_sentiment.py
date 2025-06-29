from nltk.sentiment import SentimentIntensityAnalyzer
import nltk

nltk.download("vader_lexicon")

sia = SentimentIntensityAnalyzer()


def test_articles():
    tests = [
        {
            "text": "The city council passed a bill to improve public parks and build more playgrounds.",
            "expected": "positive",
        },
        {
            "text": "Hundreds of employees were laid off after the company reported severe financial losses.",
            "expected": "negative",
        },
        {
            "text": "The weather tomorrow is expected to be partly cloudy with a slight breeze.",
            "expected": "neutral",
        },
        {
            "text": "A powerful earthquake devastated the region, leaving thousands homeless.",
            "expected": "negative",
        },
        {
            "text": "The new community center is now open, offering free classes and events to residents.",
            "expected": "positive",
        },
    ]

    for i, test in enumerate(tests, 1):
        scores = sia.polarity_scores(test["text"])
        compound = scores["compound"]
        if compound > 0.2:
            sentiment = "positive"
        elif compound < -0.2:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        print(f"Test {i}: {test['text']}")
        print(f"  Compound score: {compound:.2f}")
        print(f"  Classified as: {sentiment}")
        print(f"  Expected: {test['expected']}")
        print("---")


if __name__ == "__main__":
    test_articles()
