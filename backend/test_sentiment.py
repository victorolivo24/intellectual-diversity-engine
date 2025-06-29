from app import get_local_analysis

test_cases = [
    {
        "text": "The city finally finished the new stadium after years of delays and billions in taxpayer money. At least it looks nice.",
        "expected": "neutral or negative",
    },
    {
        "text": "Despite repeated warnings, the company continued to dump waste into the river, affecting thousands of residents.",
        "expected": "negative",
    },
    {
        "text": "The groundbreaking cancer treatment shows promise but still has a long way to go before approval.",
        "expected": "neutral or positive",
    },
    {
        "text": "Police responded quickly and no one was hurt in the incident, which could have been much worse.",
        "expected": "neutral or positive",
    },
    {
        "text": "Critics slammed the new policy as an overreach of government power, though supporters argued it was necessary.",
        "expected": "neutral",
    },
    {
        "text": "The festival was canceled due to safety concerns, leaving thousands of fans disappointed.",
        "expected": "negative",
    },
    {
        "text": "After a heated debate, lawmakers agreed on a compromise bill to fund public schools.",
        "expected": "neutral or positive",
    },
]

for idx, case in enumerate(test_cases, start=1):
    score, keywords, category = get_local_analysis(case["text"])
    classification = (
        "positive" if score > 0.05 else "negative" if score < -0.05 else "neutral"
    )
    print(f"Test {idx}: {case['text'][:60]}...")
    print(f"  Compound score: {score:.2f}")
    print(f"  Classified as: {classification}")
    print(f"  Keywords: {keywords}")
    print(f"  Expected: {case['expected']}")
    print("---")
