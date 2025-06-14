from flask import Flask, request, jsonify

# We no longer need newspaper3k
# import newspaper

# We need BeautifulSoup
from bs4 import BeautifulSoup

# Selenium imports remain the same
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze_url():
    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400

    url = data['url']
    print(f"Received URL for analysis: {url}")
    
    driver = None
    try:
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        driver = webdriver.Chrome(service=Service(), options=chrome_options)
        
        driver.execute_cdp_cmd('Network.setUserAgentOverride', {"userAgent": 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'})
        
        driver.get(url)
        
        wait = WebDriverWait(driver, 15)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "h1")))

        html = driver.page_source

        # --- THE NEW, WORKING LOGIC ---
        # 1. Parse the HTML we got from Selenium with Beautiful Soup
        soup = BeautifulSoup(html, 'html.parser')
        
        # 2. Find the <title> tag and get its text. It's that simple.
        title = soup.find('title').get_text()
        
        if not title:
             raise ValueError("Beautiful Soup failed to extract a title.")
        # ----------------------------

        print(f"Extracted Title: {title}")

        return jsonify({
            "status": "success",
            "received_url": url,
            "title": title
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
        
    finally:
        if driver:
            driver.quit()

if __name__ == '__main__':
    app.run(debug=True)