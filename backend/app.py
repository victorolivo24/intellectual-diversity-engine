# We need to import request to access incoming data, and jsonify to send JSON responses
from flask import Flask, request, jsonify

app = Flask(__name__)

# This is our original route, good to keep for testing if the server is up.
@app.route('/')
def index():
    return "Hello, World! The Echo Escape server is running."

# This is our new API endpoint.
# methods=['POST'] means it will only accept POST requests.
@app.route('/analyze', methods=['POST'])
def analyze_url():
    # 1. Get the JSON data sent from the client
    data = request.get_json()

    # 2. Check if the 'url' key exists in the JSON data
    if not data or 'url' not in data:
        # Return an error response if the URL is missing
        return jsonify({"status": "error", "message": "Missing 'url' in request"}), 400

    # 3. Extract the URL from the JSON data
    url = data['url']
    print(f"Received URL for analysis: {url}") # For debugging in our terminal

    # 4. For now, just send back a success message with the URL we received.
    #    In the future, this is where we'll do the actual analysis.
    return jsonify({"status": "success", "received_url": url})

if __name__ == '__main__':
    app.run(debug=True)